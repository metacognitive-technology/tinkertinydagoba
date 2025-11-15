// Integration between Dagoba graph and vis-network editor

window.dagobaGraph = null;
window.lukeLayerVisible = false;
window.lukeVertices = []; // Track Luke vertices that were added
window.lukeEdges = []; // Track Luke edges that were added
window.queryResults = null;
window.savedQueries = [];
window.nodeIdMap = {}; // Map Dagoba _id to vis id
window.geographicLayout = { enabled: false }; // Geographic layout settings

// Initialize Dagoba graph with genealogy data
initDagobaGraph = () => {
  // Check if Dagoba is loaded
  if (typeof Dagoba === 'undefined') {
    console.error('Dagoba is not loaded. Make sure dagoba.js is loaded before dagoba-integration.js');
    alert('Error: Dagoba library is not loaded. Please refresh the page.');
    return;
  }
  
  // Check if GremlinParser is loaded
  if (typeof window.GremlinParser === 'undefined') {
    console.error('GremlinParser is not loaded. Make sure gremlin-parser.js is loaded.');
    alert('Warning: Gremlin query parser is not loaded. Queries may not work.');
  }
  
  // Load from localStorage or create empty graph
  const saved = localStorage.getItem('dagoba_graph');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      window.dagobaGraph = Dagoba.graph(data.V || [], data.E || []);
    } catch (e) {
      console.error('Error loading saved graph:', e);
      window.dagobaGraph = Dagoba.graph([], []); // Start with empty graph
    }
  } else {
    window.dagobaGraph = Dagoba.graph([], []); // Start with empty graph
  }
  
  // Load saved queries
  const savedQueriesStr = localStorage.getItem('dagoba_saved_queries');
  if (savedQueriesStr) {
    try {
      window.savedQueries = JSON.parse(savedQueriesStr);
      // Ensure all queries have IDs
      window.savedQueries.forEach((q, idx) => {
        if (!q.id) {
          q.id = Date.now() + idx;
        }
      });
    } catch (e) {
      console.error('Error loading saved queries:', e);
      // Initialize with empty array
      window.savedQueries = [];
    }
  } else {
    // Initialize with empty array
    window.savedQueries = [];
  }
  
  // Render graph to vis-network
  renderDagobaToVis();
  renderSavedQueries();
  
  // Initialize script library display
  if (window.TabManager) {
    window.TabManager.renderScriptLibrary();
    window.TabManager.updateTabSelector();
  }
  
  // Load geographic layout settings if they exist
  const savedLayout = localStorage.getItem('geographic_layout');
  if (savedLayout) {
    try {
      window.geographicLayout = JSON.parse(savedLayout);
      if (window.geographicLayout.enabled) {
        $('#lat-property').val(window.geographicLayout.latProperty || '');
        $('#lng-property').val(window.geographicLayout.lngProperty || '');
        // Re-apply layout after a short delay to ensure graph is rendered
        setTimeout(() => {
          applyGeographicLayout();
        }, 500);
      }
    } catch (e) {
      console.warn('Error loading geographic layout settings:', e);
    }
  }
  
  // Auto-save on changes
  setupAutoSave();
};

// Helper function to update tab selector (called from tab manager)
updateTabSelector = () => {
  if (window.TabManager) {
    window.TabManager.updateTabSelector();
  }
};

createGenealogyGraph = () => {
  const graph = Dagoba.graph(GenealogyData.matthew.vertices, GenealogyData.matthew.edges);
  return graph;
};

// Convert Dagoba graph to vis-network format
dagobaToVisNetwork = (graph, highlightNodes = [], highlightEdges = []) => {
  const nodes = [];
  const edges = [];
  window.nodeIdMap = {}; // Reset map
  
  // Create nodes
  graph.vertices.forEach((vertex, index) => {
    const visId = index;
    window.nodeIdMap[vertex._id] = visId;
    
    // Determine color and shape based on attributes
    let color = '#97C2FC';
    let shape = 'box';
    
    if (vertex.royal) {
      color = '#FFD700'; // Gold for royal line
    }
    if (vertex.maternal) {
      color = '#FF69B4'; // Pink for maternal links
      shape = 'ellipse';
    }
    if (vertex.source === 'luke' && !window.lukeLayerVisible) {
      // Hide Luke layer nodes if not visible
      return;
    }
    
    // Highlight query results
    const isHighlighted = highlightNodes.includes(vertex._id);
    if (isHighlighted) {
      color = '#FF0000';
      shape = 'star';
    }
    
    // Build comprehensive tooltip with all properties
    const propertyList = [];
    Object.keys(vertex).forEach(key => {
      if (key !== '_id' && key !== '_in' && key !== '_out' && vertex[key] !== undefined && vertex[key] !== null) {
        propertyList.push(`${key}: ${vertex[key]}`);
      }
    });
    const tooltip = `${vertex.name}\n${propertyList.join('\n')}`;
    
    // Build label with key properties
    let label = vertex.name;
    const labelParts = [];
    if (vertex.generation !== undefined) labelParts.push(`Gen ${vertex.generation}`);
    if (vertex.royal) labelParts.push('👑');
    if (vertex.maternal) labelParts.push('♀');
    if (labelParts.length > 0) {
      label += `\n(${labelParts.join(', ')})`;
    }
    
    nodes.push({
      id: visId,
      label: label,
      color: { background: color },
      shape: shape,
      title: tooltip,
      dagobaId: vertex._id,
      // Store all properties for later access
      properties: Object.keys(vertex).reduce((props, key) => {
        if (key !== '_id' && key !== '_in' && key !== '_out') {
          props[key] = vertex[key];
        }
        return props;
      }, {}),
      generation: vertex.generation,
      royal: vertex.royal,
      maternal: vertex.maternal,
      source: vertex.source
    });
  });
  
  // Create edges
  graph.edges.forEach((edge, index) => {
    const fromId = window.nodeIdMap[edge._out._id];
    const toId = window.nodeIdMap[edge._in._id];
    
    if (fromId === undefined || toId === undefined) {
      return; // Skip edges for hidden nodes
    }
    
    const isHighlighted = highlightEdges.some(e => 
      (e._out === edge._out._id && e._in === edge._in._id) ||
      (typeof e === 'string' && e === edge._label)
    );
    
    // Build comprehensive tooltip with all edge properties
    const edgePropertyList = [`Label: ${edge._label}`];
    Object.keys(edge).forEach(key => {
      if (key !== '_id' && key !== '_in' && key !== '_out' && key !== '_label' && edge[key] !== undefined && edge[key] !== null) {
        const value = typeof edge[key] === 'object' ? JSON.stringify(edge[key]) : edge[key];
        edgePropertyList.push(`${key}: ${value}`);
      }
    });
    const edgeTooltip = `${edge._out.name || edge._out._id} --[${edge._label}]--> ${edge._in.name || edge._in._id}\n${edgePropertyList.join('\n')}`;
    
    // Edge label: only show the label, no properties
    const edgeLabel = edge._label;
    
    edges.push({
      id: `e${index}`,
      from: fromId,
      to: toId,
      label: edgeLabel,
      color: isHighlighted ? { color: '#FF0000', highlight: '#FF0000' } : { color: '#848484' },
      width: isHighlighted ? 3 : 1, // Wider for highlighted edges
      arrows: 'to',
      title: edgeTooltip,
      dagobaEdge: edge,
      // Store all edge properties
      properties: Object.keys(edge).reduce((props, key) => {
        if (key !== '_id' && key !== '_in' && key !== '_out' && key !== '_label') {
          props[key] = edge[key];
        }
        return props;
      }, {})
    });
  });
  
  return { nodes, edges };
};

// Render Dagoba graph to vis-network
renderDagobaToVis = (highlightNodes = [], highlightEdges = []) => {
  if (!window.dagobaGraph) return;
  
  // Set cursor to wait during rendering
  const networkContainer = document.getElementById('mynetwork');
  const body = document.body;
  if (networkContainer) {
    networkContainer.style.cursor = 'wait';
  }
  if (body) {
    body.style.cursor = 'wait';
  }
  
  // Use setTimeout to allow UI to update cursor before heavy processing
  setTimeout(() => {
    try {
      const data = dagobaToVisNetwork(window.dagobaGraph, highlightNodes, highlightEdges);
      
      if (window.network) {
        const nodesDataSet = new vis.DataSet(data.nodes);
        const edgesDataSet = new vis.DataSet(data.edges);
        window.network.setData({ nodes: nodesDataSet, edges: edgesDataSet });
        
        // Ensure property display is set up
        setupPropertyDisplay();
        
        // Wait for network to stabilize before restoring cursor
        if (window.network.physics && window.network.physics.physicsEnabled) {
          window.network.once('stabilizationEnd', () => {
            if (networkContainer) networkContainer.style.cursor = '';
            if (body) body.style.cursor = '';
          });
          // Also set a timeout as fallback in case stabilization doesn't fire
          setTimeout(() => {
            if (networkContainer) networkContainer.style.cursor = '';
            if (body) body.style.cursor = '';
          }, 2000);
        } else {
          // If physics is disabled, restore cursor immediately
          if (networkContainer) networkContainer.style.cursor = '';
          if (body) body.style.cursor = '';
        }
      } else {
        // Initialize vis-network if not already done
        // Use defaultOptions if available, otherwise create basic options
        const options = window.defaultOptions || {
          interaction: { hover: true },
          physics: true,
          nodes: { shape: "box" },
          edges: { arrows: { to: { enabled: true } } }
        };
        const nodesDataSet = new vis.DataSet(data.nodes);
        const edgesDataSet = new vis.DataSet(data.edges);
        window.network = new vis.Network($('#mynetwork')[0], 
          { nodes: nodesDataSet, edges: edgesDataSet }, 
          options);
        
        // Setup event handlers for showing properties
        setupPropertyDisplay();
        
        // Wait for network to stabilize before restoring cursor
        if (window.network.physics && window.network.physics.physicsEnabled) {
          window.network.once('stabilizationEnd', () => {
            if (networkContainer) networkContainer.style.cursor = '';
            if (body) body.style.cursor = '';
          });
          // Also set a timeout as fallback
          setTimeout(() => {
            if (networkContainer) networkContainer.style.cursor = '';
            if (body) body.style.cursor = '';
          }, 2000);
        } else {
          // If physics is disabled, restore cursor immediately
          if (networkContainer) networkContainer.style.cursor = '';
          if (body) body.style.cursor = '';
        }
      }
    } catch (error) {
      console.error('Error rendering graph:', error);
      // Restore cursor on error
      if (networkContainer) networkContainer.style.cursor = '';
      if (body) body.style.cursor = '';
    }
  }, 10);
};

// Setup property display on node/edge selection
setupPropertyDisplay = () => {
  if (!window.network) return;
  
  // Prevent duplicate event listeners
  if (window.propertyDisplaySetup) return;
  window.propertyDisplaySetup = true;
  
  // Handle node selection
  window.network.on('selectNode', (params) => {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      const node = window.network.body.data.nodes.get(nodeId);
      if (node) {
        showNodeProperties(node);
      }
    }
  });
  
  // Handle edge selection
  window.network.on('selectEdge', (params) => {
    if (params.edges.length > 0) {
      const edgeId = params.edges[0];
      const edge = window.network.body.data.edges.get(edgeId);
      if (edge) {
        showEdgeProperties(edge);
      }
    }
  });
  
  // Handle deselection
  window.network.on('deselectNode', () => {
    hideProperties();
  });
  
  window.network.on('deselectEdge', () => {
    hideProperties();
  });
  
  // Handle click on background
  window.network.on('click', (params) => {
    if (params.nodes.length === 0 && params.edges.length === 0) {
      hideProperties();
    }
  });
};

// Show node properties
showNodeProperties = (node) => {
  const content = $('#properties-content');
  let html = `<strong>Node: ${node.label.split('\n')[0]}</strong><br><br>`;
  html += '<strong>Properties:</strong><br>';
  html += '<table class="table table-condensed" style="margin: 0; font-size: 0.85em;">';
  
  // Show all properties
  if (node.properties) {
    Object.keys(node.properties).forEach(key => {
      const value = node.properties[key];
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      html += `<tr><td><strong>${key}:</strong></td><td>${displayValue}</td></tr>`;
    });
  } else {
    // Fallback to direct properties
    Object.keys(node).forEach(key => {
      if (key !== 'id' && key !== 'label' && key !== 'color' && key !== 'shape' && 
          key !== 'title' && key !== 'dagobaId' && key !== 'x' && key !== 'y' &&
          key !== 'physics' && key !== 'fixed' && key !== 'hidden') {
        const value = node[key];
        if (value !== undefined && value !== null) {
          const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          html += `<tr><td><strong>${key}:</strong></td><td>${displayValue}</td></tr>`;
        }
      }
    });
  }
  
  html += '</table>';
  content.html(html);
  $('#properties-panel').show();
};

// Show edge properties
showEdgeProperties = (edge) => {
  const content = $('#properties-content');
  let html = `<strong>Edge: ${edge.label.split('\n')[0]}</strong><br><br>`;
  html += '<strong>Properties:</strong><br>';
  html += '<table class="table table-condensed" style="margin: 0; font-size: 0.85em;">';
  
  // Show edge label
  html += `<tr><td><strong>label:</strong></td><td>${edge.label.split('\n')[0]}</td></tr>`;
  
  // Show from/to
  const fromNode = window.network.body.data.nodes.get(edge.from);
  const toNode = window.network.body.data.nodes.get(edge.to);
  if (fromNode) html += `<tr><td><strong>from:</strong></td><td>${fromNode.label.split('\n')[0]}</td></tr>`;
  if (toNode) html += `<tr><td><strong>to:</strong></td><td>${toNode.label.split('\n')[0]}</td></tr>`;
  
  // Show all edge properties
  if (edge.properties) {
    Object.keys(edge.properties).forEach(key => {
      const value = edge.properties[key];
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      html += `<tr><td><strong>${key}:</strong></td><td>${displayValue}</td></tr>`;
    });
  } else if (edge.dagobaEdge) {
    // Extract properties from dagobaEdge
    Object.keys(edge.dagobaEdge).forEach(key => {
      if (key !== '_id' && key !== '_in' && key !== '_out' && key !== '_label') {
        const value = edge.dagobaEdge[key];
        if (value !== undefined && value !== null) {
          const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          html += `<tr><td><strong>${key}:</strong></td><td>${displayValue}</td></tr>`;
        }
      }
    });
  }
  
  html += '</table>';
  content.html(html);
  $('#properties-panel').show();
};

// Hide properties panel
hideProperties = () => {
  $('#properties-panel').hide();
  $('#properties-content').html('');
};

// Clear Gremlin log pane
clearGremlinLog = () => {
  $('#gremlin-log').html('');
};

// Execute Gremlin query
executeQuery = () => {
  const queryText = $('#query-editor').val().trim();
  if (!queryText) {
    alert('Please enter a query');
    return;
  }
  
  // Set cursor to progress during query execution
  const networkContainer = document.getElementById('mynetwork');
  const body = document.body;
  const queryEditor = document.getElementById('query-editor');
  if (networkContainer) {
    networkContainer.style.cursor = 'progress';
  }
  if (body) {
    body.style.cursor = 'progress';
  }
  if (queryEditor) {
    queryEditor.style.cursor = 'progress';
  }
  
  // Use setTimeout to allow UI to update cursor before query execution
  setTimeout(() => {
    try {
      console.log('Executing query:', queryText);
      
      // Check if GremlinParser is available
      if (typeof window.GremlinParser === 'undefined') {
        throw new Error('GremlinParser is not loaded. Please refresh the page.');
      }
      
      const results = window.GremlinParser.execute(window.dagobaGraph, queryText);
      console.log('Query results:', results);
    
    // Extract node IDs and edge objects from results
    const highlightNodes = [];
    const highlightEdges = [];
    
    results.forEach(r => {
      if (r && typeof r === 'object') {
        // Check if this is an edge result (has _out and _in properties directly, or is an edge object)
        if (r._out && r._in && r._label) {
          // This is an edge - only highlight the edge, not the vertices
          highlightEdges.push({
            _out: r._out._id || r._out,
            _in: r._in._id || r._in,
            _label: r._label
          });
          // Do NOT highlight the connected vertices for edge queries
        } else if (r._id) {
          // This is a vertex
          highlightNodes.push(r._id);
        } else if (typeof r === 'string') {
          highlightNodes.push(r);
        }
      }
    });
    
    console.log('Highlight nodes:', highlightNodes);
    console.log('Highlight edges:', highlightEdges);
    
    window.queryResults = { nodes: highlightNodes, edges: highlightEdges, results: results };
    
    // Get target tab for visualization
    const targetTabSelect = document.getElementById('result-tab-select');
    const targetTabId = targetTabSelect ? targetTabSelect.value : 'current';
    
    // Assign results to the selected tab
    if (window.TabManager && targetTabId !== 'current') {
      window.TabManager.assignResultsToTab(targetTabId, window.queryResults);
    } else if (window.TabManager) {
      // Save to current tab
      window.TabManager.saveCurrentTabState();
    }
    
    // Update highlights without changing layout (only if current tab)
    if (targetTabId === 'current' || !targetTabSelect) {
      updateQueryHighlights(highlightNodes, highlightEdges);
    }
    
    // Show results
    if (results.length === 0) {
      $('#query-results').html(`<strong>No results found</strong><br><small>Try: v({name: "Jesus Christ"}) or v().filter({royal: true})</small>`);
    } else {
      $('#query-results').html(`<strong>Results (${results.length}):</strong><br>` + 
        results.map((r, i) => {
          if (r && typeof r === 'object') {
            // Check if it's an edge (has _out, _in, _label)
            if (r._out && r._in && r._label) {
              const outName = (r._out && r._out.name) ? r._out.name : (r._out && r._out._id) ? r._out._id : r._out;
              const inName = (r._in && r._in.name) ? r._in.name : (r._in && r._in._id) ? r._in._id : r._in;
              return `${i + 1}. Edge: ${outName} --[${r._label}]--> ${inName}`;
            }
            // Check if it's a vertex with a name
            if (r.name) return `${i + 1}. ${r.name}`;
            // Check if it's a vertex with an _id
            if (r._id) return `${i + 1}. Vertex: ${r._id}`;
            // For other objects, try to create a safe string representation
            try {
              // Create a safe copy without circular references
              const safe = {};
              Object.keys(r).forEach(key => {
                if (key !== '_out' && key !== '_in') {
                  if (typeof r[key] === 'object' && r[key] !== null) {
                    if (r[key]._id) safe[key] = r[key]._id;
                    else if (r[key].name) safe[key] = r[key].name;
                    else safe[key] = '[Object]';
                  } else {
                    safe[key] = r[key];
                  }
                }
              });
              return `${i + 1}. ${JSON.stringify(safe)}`;
            } catch (e) {
              return `${i + 1}. [Complex Object]`;
            }
          }
          return `${i + 1}. ${String(r)}`;
        }).join('<br>'));
    }
    
    // Restore cursor after query execution
    if (networkContainer) networkContainer.style.cursor = '';
    if (body) body.style.cursor = '';
    if (queryEditor) queryEditor.style.cursor = '';
  } catch (error) {
    alert('Query error: ' + error.message);
    console.error('Query execution error:', error);
    console.error('Query was:', queryText);
    
    // Restore cursor on error
    if (networkContainer) networkContainer.style.cursor = '';
    if (body) body.style.cursor = '';
    if (queryEditor) queryEditor.style.cursor = '';
  }
  }, 10);
};

// Update query highlights without changing layout
updateQueryHighlights = (highlightNodes = [], highlightEdges = []) => {
  if (!window.network) return;
  
  const nodesDataSet = window.network.body.data.nodes;
  const edgesDataSet = window.network.body.data.edges;
  
  // Update node colors and shapes for highlights
  const allNodes = nodesDataSet.get();
  allNodes.forEach(node => {
    const isHighlighted = highlightNodes.includes(node.dagobaId);
    const updates = {};
    
    if (isHighlighted) {
      updates.color = { background: '#FF0000' };
      updates.shape = 'star';
    } else {
      // Restore original styling
      if (node.royal) {
        updates.color = { background: '#FFD700' }; // Gold for royal
      } else if (node.maternal) {
        updates.color = { background: '#FF69B4' }; // Pink for maternal
      } else {
        updates.color = { background: '#97C2FC' }; // Default blue
      }
      updates.shape = node.maternal ? 'ellipse' : 'box';
    }
    
    nodesDataSet.update({ id: node.id, ...updates });
  });
  
  // Update edge colors and widths for highlights
  const allEdges = edgesDataSet.get();
  allEdges.forEach(edge => {
    let isHighlighted = false;
    if (edge.dagobaEdge) {
      const edgeOutId = edge.dagobaEdge._out?._id || (typeof edge.dagobaEdge._out === 'string' ? edge.dagobaEdge._out : null);
      const edgeInId = edge.dagobaEdge._in?._id || (typeof edge.dagobaEdge._in === 'string' ? edge.dagobaEdge._in : null);
      const edgeLabel = edge.dagobaEdge._label || edge.label;
      
      isHighlighted = highlightEdges.some(e => {
        if (typeof e === 'string') {
          return e === edgeLabel;
        }
        if (e._out && e._in) {
          // Match by out/in IDs and optionally label
          const outMatch = e._out === edgeOutId;
          const inMatch = e._in === edgeInId;
          const labelMatch = !e._label || e._label === edgeLabel;
          return outMatch && inMatch && labelMatch;
        }
        return false;
      });
    }
    
    const updates = {
      id: edge.id,
      color: isHighlighted ? { color: '#FF0000', highlight: '#FF0000' } : { color: '#848484' }
    };
    
    // Make highlighted edges wider
    if (isHighlighted) {
      updates.width = 3; // Wider for highlighted edges
    } else {
      updates.width = 1; // Default width
    }
    
    edgesDataSet.update(updates);
  });
};

// Clear query results
clearQueryResults = () => {
  window.queryResults = null;
  updateQueryHighlights(); // Clear highlights
  $('#query-results').html('');
};

// Toggle Luke 3 layer
toggleLukeLayer = () => {
  window.lukeLayerVisible = !window.lukeLayerVisible;
  
  if (window.lukeLayerVisible) {
    // Add Luke's genealogy - only add vertices/edges that aren't already added
    const verticesToAdd = GenealogyData.luke.vertices.filter(v => {
      return !window.lukeVertices.some(lv => lv._id === v._id);
    });
    const edgesToAdd = GenealogyData.luke.edges.filter(e => {
      return !window.lukeEdges.some(le => 
        le._out === e._out && le._in === e._in && le._label === e._label
      );
    });
    
    verticesToAdd.forEach(v => {
      try {
        window.dagobaGraph.addVertex(v);
        window.lukeVertices.push(v);
      } catch (e) {
        console.warn('Vertex already exists:', v._id, e);
      }
    });
    
    edgesToAdd.forEach(e => {
      try {
        window.dagobaGraph.addEdge(e);
        window.lukeEdges.push(e);
      } catch (e) {
        console.warn('Edge already exists or vertex missing:', e);
      }
    });
  } else {
    // Remove Luke's genealogy - remove tracked vertices (which will also remove their edges)
    window.lukeVertices.forEach(v => {
      try {
        const vertex = window.dagobaGraph.findVertexById(v._id);
        if (vertex) {
          window.dagobaGraph.removeVertex(vertex);
        }
      } catch (e) {
        console.warn('Error removing vertex:', v._id, e);
      }
    });
    
    // Clear the tracking arrays
    window.lukeVertices = [];
    window.lukeEdges = [];
  }
  
  // Re-render graph (needed when adding/removing nodes)
  renderDagobaToVis();
  
  // Restore query highlights if they exist
  if (window.queryResults) {
    setTimeout(() => {
      updateQueryHighlights(window.queryResults.nodes, window.queryResults.edges);
    }, 100);
  }
  
  saveGraph();
};

// Save query
saveQuery = (name, query) => {
  window.savedQueries.push({ name, query, id: Date.now() });
  localStorage.setItem('dagoba_saved_queries', JSON.stringify(window.savedQueries));
  renderSavedQueries();
};

// Delete query
deleteQuery = (id) => {
  window.savedQueries = window.savedQueries.filter(q => q.id !== id);
  localStorage.setItem('dagoba_saved_queries', JSON.stringify(window.savedQueries));
  renderSavedQueries();
};

// Render saved queries list
renderSavedQueries = () => {
  const container = $('#saved-queries-list');
  container.html('<h5>Saved Queries:</h5>');
  
  if (window.savedQueries.length === 0) {
    container.append('<p>No saved queries. Use "Save Query" to save one.</p>');
    return;
  }
  
  window.savedQueries.forEach(query => {
    const div = $('<div class="saved-query-item" style="margin: 5px 0; padding: 5px; border: 1px solid #ddd; border-radius: 3px;"></div>');
    // Use data attribute and event handler to avoid issues with template literals and IDs
    const queryId = query.id;
    div.html(`
      <strong>${query.name}</strong>
      <button class="btn btn-xs btn-primary load-query-btn" data-query-id="${queryId}" style="margin-left: 5px;">Load</button>
      <button class="btn btn-xs btn-danger delete-query-btn" data-query-id="${queryId}" style="margin-left: 5px;">Delete</button>
      <div style="font-size: 0.8em; color: #666; margin-top: 3px;">${query.query}</div>
    `);
    // Attach event handlers
    div.find('.load-query-btn').on('click', function() {
      const id = $(this).data('query-id');
      loadQuery(id);
    });
    div.find('.delete-query-btn').on('click', function() {
      const id = $(this).data('query-id');
      deleteQuery(id);
    });
    container.append(div);
  });
};

// Load query into editor
loadQuery = (id) => {
  // Convert id to number for comparison
  const queryId = typeof id === 'string' ? parseInt(id, 10) : id;
  const query = window.savedQueries.find(q => {
    const qId = typeof q.id === 'string' ? parseInt(q.id, 10) : q.id;
    return qId === queryId;
  });
  if (query) {
    $('#query-editor').val(query.query);
    console.log('Loaded query:', query.name, query.query);
  } else {
    console.error('Query not found with id:', id, 'Available queries:', window.savedQueries.map(q => ({id: q.id, name: q.name})));
  }
};

// Save current query (renamed from showNewQueryDialog)
saveCurrentQuery = () => {
  const queryText = $('#query-editor').val().trim();
  if (!queryText) {
    alert('Please enter a query first');
    return;
  }
  
  // Use native prompt instead of bootbox
  const name = prompt('Enter a name for this query:', '');
  if (name && name.trim()) {
    saveQuery(name.trim(), queryText);
    alert('Query saved successfully!');
  }
};

// Generate random graph
generateRandomGraph = () => {
  if (!window.dagobaGraph) {
    alert('Graph not initialized');
    return;
  }
  
  // Prompt for parameters
  const numVertices = parseInt(prompt('Number of vertices:', '50'), 10);
  if (isNaN(numVertices) || numVertices < 1) {
    alert('Invalid number of vertices');
    return;
  }
  
  const numEdges = parseInt(prompt('Number of edges:', '100'), 10);
  if (isNaN(numEdges) || numEdges < 0) {
    alert('Invalid number of edges');
    return;
  }
  
  const addProperties = confirm('Add random properties to vertices?');
  const edgeLabels = confirm('Use random edge labels?');
  
  // Ask if user wants to clear existing graph or add to it
  const clearFirst = confirm('Clear existing graph before generating? (Cancel to add to existing)');
  
  if (clearFirst) {
    // Clear existing graph - make a copy of vertices array to avoid modification during iteration
    const verticesToRemove = window.dagobaGraph.vertices.slice();
    verticesToRemove.forEach(v => {
      try {
        window.dagobaGraph.removeVertex(v);
      } catch (e) {
        // Vertex might already be removed, skip
      }
    });
    // Recreate empty graph
    window.dagobaGraph = Dagoba.graph([], []);
  }
  
  // Generate random names and labels
  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 
                      'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Paul', 'Quinn', 'Rachel', 'Sam', 'Tina',
                      'Uma', 'Victor', 'Wendy', 'Xander', 'Yara', 'Zoe'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
                     'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee'];
  const edgeLabelOptions = ['knows', 'follows', 'likes', 'works_with', 'friend', 'colleague', 'partner', 'connects', 'links', 'related'];
  const propertyKeys = ['age', 'score', 'rating', 'level', 'rank', 'weight', 'height', 'value', 'count', 'index'];
  
  // Generate vertices
  const vertices = [];
  const vertexIds = [];
  
  for (let i = 0; i < numVertices; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const name = `${firstName} ${lastName}`;
    
    const vertex = {
      name: name,
      type: Math.random() > 0.7 ? 'person' : (Math.random() > 0.5 ? 'entity' : 'node')
    };
    
    // Add random properties
    if (addProperties) {
      const numProps = Math.floor(Math.random() * 4) + 1; // 1-4 properties
      for (let j = 0; j < numProps; j++) {
        const propKey = propertyKeys[Math.floor(Math.random() * propertyKeys.length)];
        if (propKey === 'age') {
          vertex[propKey] = Math.floor(Math.random() * 80) + 18; // 18-97
        } else if (propKey === 'score' || propKey === 'rating') {
          vertex[propKey] = Math.floor(Math.random() * 100);
        } else if (propKey === 'level' || propKey === 'rank') {
          vertex[propKey] = Math.floor(Math.random() * 10) + 1;
        } else {
          vertex[propKey] = Math.floor(Math.random() * 1000);
        }
      }
    }
    
    // Add vertex to graph
    const vertexId = window.dagobaGraph.addVertex(vertex);
    vertices.push(vertex);
    vertexIds.push(vertexId);
  }
  
  // Generate edges
  const edges = [];
  const edgeSet = new Set(); // Track edges to avoid duplicates
  const maxEdges = Math.min(numEdges, numVertices * (numVertices - 1)); // Prevent more edges than possible
  let attempts = 0;
  const maxAttempts = maxEdges * 10; // Prevent infinite loops
  
  while (edges.length < maxEdges && attempts < maxAttempts) {
    attempts++;
    
    // Randomly select two different vertices
    const fromIndex = Math.floor(Math.random() * numVertices);
    let toIndex = Math.floor(Math.random() * numVertices);
    
    // Ensure different vertices
    while (toIndex === fromIndex && numVertices > 1) {
      toIndex = Math.floor(Math.random() * numVertices);
    }
    
    const fromVertex = vertices[fromIndex];
    const toVertex = vertices[toIndex];
    
    if (!fromVertex || !toVertex) continue;
    
    // Create edge key to check for duplicates
    const edgeKey = `${fromVertex._id}_${toVertex._id}`;
    if (edgeSet.has(edgeKey)) {
      continue; // Skip duplicate edge
    }
    
    const label = edgeLabels ? edgeLabelOptions[Math.floor(Math.random() * edgeLabelOptions.length)] : 'edge';
    const edge = {
      _out: fromVertex._id,
      _in: toVertex._id,
      _label: label
    };
    
    // Add random edge properties sometimes
    if (Math.random() > 0.7) {
      edge.weight = Math.random();
      edge.strength = Math.floor(Math.random() * 10) + 1;
    }
    
    try {
      window.dagobaGraph.addEdge(edge);
      edges.push(edge);
      edgeSet.add(edgeKey);
    } catch (e) {
      // Edge might already exist or vertices not found, skip it
      console.warn('Could not add edge:', e);
    }
  }
  
  // Re-render the graph
  renderDagobaToVis();
  saveGraph();
  
  alert(`Generated random graph:\n- ${vertices.length} vertices\n- ${edges.length} edges`);
};

// Save to script library
saveToScriptLibrary = () => {
  const queryText = $('#query-editor').val().trim();
  if (!queryText) {
    alert('Please enter a query first');
    return;
  }
  
  const name = prompt('Enter a name for this script:', '');
  if (!name || !name.trim()) {
    return;
  }
  
  const description = prompt('Enter a description (optional):', '');
  
  // Get category selection
  let category = null;
  if (window.TabManager && window.TabManager.categories.length > 0) {
    const categoryNames = window.TabManager.categories.map(c => c.name).join(', ');
    const categoryInput = prompt(`Enter category (${categoryNames}) or leave blank for current:`, '');
    if (categoryInput && categoryInput.trim()) {
      const foundCat = window.TabManager.categories.find(c => 
        c.name.toLowerCase() === categoryInput.trim().toLowerCase()
      );
      category = foundCat ? foundCat.id : window.TabManager.selectedCategory || 'general';
    } else {
      category = window.TabManager.selectedCategory || 'general';
    }
  }
  
  if (window.TabManager) {
    window.TabManager.saveToScriptLibrary(name.trim(), queryText, description || '', category);
    window.TabManager.renderScriptLibrary();
    alert('Script saved to library!');
  } else {
    alert('Tab manager not initialized');
  }
};

// Save graph to localStorage
saveGraph = () => {
  try {
    // Save to current tab if tab manager is active
    if (window.TabManager && window.TabManager.activeTabId) {
      window.TabManager.saveCurrentTabState();
    }
    
    // Also save to legacy localStorage for backward compatibility
    const graphData = {
      V: window.dagobaGraph.vertices.map(v => {
        const clean = {};
        Object.keys(v).forEach(key => {
          if (key !== '_in' && key !== '_out') {
            clean[key] = v[key];
          }
        });
        return clean;
      }),
      E: window.dagobaGraph.edges.map(e => ({
        _out: e._out._id,
        _in: e._in._id,
        _label: e._label
      }))
    };
    localStorage.setItem('dagoba_graph', JSON.stringify(graphData));
  } catch (e) {
    console.error('Error saving graph:', e);
  }
};

// Load data set functions
loadMatthewGenealogy = () => {
  if (!window.dagobaGraph) {
    alert('Graph not initialized');
    return;
  }
  
  try {
    // Add Matthew genealogy vertices and edges
    GenealogyData.matthew.vertices.forEach(v => {
      try {
        window.dagobaGraph.addVertex(v);
      } catch (e) {
        // Vertex might already exist, skip
      }
    });
    
    GenealogyData.matthew.edges.forEach(e => {
      try {
        window.dagobaGraph.addEdge(e);
      } catch (e) {
        // Edge might already exist, skip
      }
    });
    
    renderDagobaToVis();
    saveGraph();
    alert(`Loaded ${GenealogyData.matthew.vertices.length} vertices and ${GenealogyData.matthew.edges.length} edges from Matthew genealogy.`);
  } catch (e) {
    console.error('Error loading Matthew genealogy:', e);
    alert('Error loading Matthew genealogy: ' + e.message);
  }
};

loadLukeGenealogy = () => {
  if (!window.dagobaGraph) {
    alert('Graph not initialized');
    return;
  }
  
  try {
    // Add Luke genealogy vertices and edges
    let verticesAdded = 0;
    let edgesAdded = 0;
    
    GenealogyData.luke.vertices.forEach(v => {
      try {
        window.dagobaGraph.addVertex(v);
        verticesAdded++;
      } catch (e) {
        // Vertex might already exist, skip
      }
    });
    
    GenealogyData.luke.edges.forEach(e => {
      try {
        window.dagobaGraph.addEdge(e);
        edgesAdded++;
      } catch (e) {
        // Edge might already exist, skip
      }
    });
    
    renderDagobaToVis();
    saveGraph();
    alert(`Loaded ${verticesAdded} vertices and ${edgesAdded} edges from Luke genealogy.`);
  } catch (e) {
    console.error('Error loading Luke genealogy:', e);
    alert('Error loading Luke genealogy: ' + e.message);
  }
};

loadInterstateData = () => {
  if (!window.dagobaGraph) {
    alert('Graph not initialized');
    return;
  }
  
  // Load the interstate GraphSON file
  fetch('us_primary_interstates_path.graphson')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(content => {
      try {
        importGraphSON(content);
        alert('Interstate data loaded successfully!');
      } catch (e) {
        console.error('Error importing interstate data:', e);
        alert('Error importing interstate data: ' + e.message);
      }
    })
    .catch(error => {
      console.error('Error loading interstate file:', error);
      alert('Error loading interstate file: ' + error.message);
    });
};

// Clear all localStorage data
clearAllLocalStorage = () => {
  if (!confirm('Are you sure you want to clear ALL localStorage data?\n\nThis will remove:\n' +
               '- All graph data\n' +
               '- All saved queries\n' +
               '- All tabs\n' +
               '- All script library entries\n' +
               '- All geographic layout settings\n\n' +
               'This action cannot be undone!')) {
    return;
  }
  
  try {
    // Clear all TinkerTiny-related localStorage keys
    localStorage.removeItem('dagoba_graph');
    localStorage.removeItem('dagoba_saved_queries');
    localStorage.removeItem('tinkertiny_tabs');
    localStorage.removeItem('tinkertiny_script_library');
    localStorage.removeItem('geographic_layout');
    
    // Reset graph
    window.dagobaGraph = Dagoba.graph([], []);
    window.savedQueries = [];
    window.queryResults = null;
    window.lukeLayerVisible = false;
    window.lukeVertices = [];
    window.lukeEdges = [];
    
    // Reset tab manager
    if (window.TabManager) {
      window.TabManager.tabs = [];
      window.TabManager.scriptLibrary = [];
      window.TabManager.categories = [];
      window.TabManager.selectedCategory = 'all';
      
      // Reinitialize with default tab
      window.TabManager.createTab('Tab 1');
    }
    
    // Clear query editor
    const queryEditor = document.getElementById('query-editor');
    if (queryEditor) {
      queryEditor.value = '';
    }
    
    // Clear query results
    const queryResults = document.getElementById('query-results');
    if (queryResults) {
      queryResults.innerHTML = '';
    }
    
    // Re-render everything
    renderDagobaToVis();
    renderSavedQueries();
    clearQueryResults();
    
    if (window.TabManager) {
      window.TabManager.renderTabs();
      window.TabManager.renderScriptLibrary();
    }
    
    alert('All localStorage data has been cleared. The page will refresh.');
    
    // Reload page to ensure clean state
    setTimeout(() => {
      window.location.reload();
    }, 500);
  } catch (e) {
    console.error('Error clearing localStorage:', e);
    alert('Error clearing localStorage: ' + e.message);
  }
};

// Reset graph to initial state and clear localStorage
resetGraph = () => {
  if (!confirm('Are you sure you want to reset the graph? This will:\n' +
               '- Clear all saved data from localStorage\n' +
               '- Reset the graph to empty\n' +
               '- Clear all saved queries\n' +
               '- Clear the Luke 3 layer\n\n' +
               'This action cannot be undone.')) {
    return;
  }
  
  try {
    // Clear localStorage
    localStorage.removeItem('dagoba_graph');
    localStorage.removeItem('dagoba_saved_queries');
    
    // Reset graph to empty
    window.dagobaGraph = Dagoba.graph([], []);
    
    // Reset Luke layer state
    window.lukeLayerVisible = false;
    window.lukeVertices = [];
    window.lukeEdges = [];
    
    // Reset saved queries to defaults
    window.savedQueries = [];
    
    // Clear query results
    window.queryResults = null;
    $('#query-editor').val('');
    $('#query-results').html('');
    
    // Re-render everything
    renderDagobaToVis();
    renderSavedQueries();
    clearQueryResults();
    
    // Save the reset state
    saveGraph();
    localStorage.setItem('dagoba_saved_queries', JSON.stringify(window.savedQueries));
    
    alert('Graph has been reset to initial state.');
  } catch (e) {
    console.error('Error resetting graph:', e);
    alert('Error resetting graph: ' + e.message);
  }
};

// Setup auto-save
setupAutoSave = () => {
  // Auto-save every 5 seconds
  setInterval(() => {
    saveGraph();
  }, 5000);
};

// Apply geographic layout based on latitude/longitude properties
applyGeographicLayout = () => {
  if (!window.network || !window.dagobaGraph) {
    alert('Graph not initialized');
    return;
  }
  
  const latProp = $('#lat-property').val().trim();
  const lngProp = $('#lng-property').val().trim();
  
  if (!latProp || !lngProp) {
    alert('Please specify both latitude and longitude property names');
    return;
  }
  
  // Get all nodes from the network
  const nodesDataSet = window.network.body.data.nodes;
  const allNodes = nodesDataSet.get();
  
  // Collect all vertices with lat/lng coordinates
  const verticesWithCoords = [];
  allNodes.forEach(node => {
    if (node.properties) {
      const lat = node.properties[latProp];
      const lng = node.properties[lngProp];
      if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
        verticesWithCoords.push({
          nodeId: node.id,
          lat: parseFloat(lat),
          lng: parseFloat(lng)
        });
      }
    }
  });
  
  if (verticesWithCoords.length === 0) {
    alert(`No vertices found with both "${latProp}" and "${lngProp}" properties`);
    return;
  }
  
  // Calculate bounding box
  const lats = verticesWithCoords.map(v => v.lat);
  const lngs = verticesWithCoords.map(v => v.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  
  // Get network canvas dimensions (approximate, will adjust)
  const container = $('#mynetwork');
  const width = container.width() || 800;
  const height = container.height() || 600;
  
  // Calculate scale factors (with padding)
  const padding = 50;
  const latRange = maxLat - minLat || 1; // Avoid division by zero
  const lngRange = maxLng - minLng || 1;
  const scaleX = (width - 2 * padding) / lngRange;
  const scaleY = (height - 2 * padding) / latRange;
  
  // Apply coordinates to nodes
  const updates = [];
  verticesWithCoords.forEach(v => {
    // Convert lat/lng to screen coordinates
    // Note: In typical map projections, longitude maps to X and latitude maps to Y
    // But we may want to flip Y axis depending on coordinate system
    const x = padding + (v.lng - minLng) * scaleX;
    const y = padding + (maxLat - v.lat) * scaleY; // Flip Y so north is up
    
    updates.push({
      id: v.nodeId,
      x: x,
      y: y,
      fixed: { x: true, y: true }, // Fix position
      physics: false // Disable physics for this node
    });
  });
  
  // Update all nodes
  nodesDataSet.update(updates);
  
  // Disable physics globally
  if (window.network.setOptions) {
    window.network.setOptions({
      physics: {
        enabled: false
      }
    });
  }
  
  // Store layout settings
  window.geographicLayout = {
    enabled: true,
    latProperty: latProp,
    lngProperty: lngProp
  };
  
  // Save to localStorage
  localStorage.setItem('geographic_layout', JSON.stringify(window.geographicLayout));
  
  alert(`Geographic layout applied to ${verticesWithCoords.length} vertices. Physics disabled.`);
};

// Clear geographic layout
clearGeographicLayout = () => {
  if (!window.network) {
    return;
  }
  
  // Clear property inputs
  $('#lat-property').val('');
  $('#lng-property').val('');
  
  // Get all nodes and unfix them
  const nodesDataSet = window.network.body.data.nodes;
  const allNodes = nodesDataSet.get();
  const updates = allNodes.map(node => ({
    id: node.id,
    fixed: false,
    physics: true
  }));
  
  nodesDataSet.update(updates);
  
  // Re-enable physics
  if (window.network.setOptions) {
    window.network.setOptions({
      physics: {
        enabled: true
      }
    });
  }
  
  // Clear layout settings
  window.geographicLayout = {
    enabled: false
  };
  
  localStorage.removeItem('geographic_layout');
  
  // Re-render to let physics take over
  window.network.startSimulation();
  
  alert('Geographic layout cleared. Physics re-enabled.');
};

// GraphSON export
exportGraphSON = () => {
  const graphson = {
    mode: 'NORMAL',
    vertices: window.dagobaGraph.vertices.map(v => ({
      id: v._id,
      label: 'person',
      properties: Object.keys(v).reduce((props, key) => {
        if (key !== '_id' && key !== '_in' && key !== '_out') {
          props[key] = [{ id: Date.now() + Math.random(), value: v[key] }];
        }
        return props;
      }, {})
    })),
    edges: window.dagobaGraph.edges.map(e => ({
      id: `e${Date.now()}_${Math.random()}`,
      label: e._label,
      outV: e._out._id,
      inV: e._in._id,
      properties: {}
    }))
  };
  
  const blob = new Blob([JSON.stringify(graphson, null, 2)], { type: 'application/json' });
  saveAs(blob, 'genealogy-graphson.json');
};

// GraphSON import
importGraphSON = (jsonData) => {
  try {
    let graphson;
    let vertices, edges;
    
    // Check if input is line-delimited GraphSON (one JSON object per line)
    if (typeof jsonData === 'string' && jsonData.includes('\n')) {
      // Try to parse as line-delimited format
      const lines = jsonData.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const parsedLines = [];
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          parsedLines.push(parsed);
        } catch (e) {
          // If any line fails to parse, it's not line-delimited format
          // Fall through to standard JSON parsing
          break;
        }
      }
      
      // If we successfully parsed all lines, treat as line-delimited format
      if (parsedLines.length === lines.length && parsedLines.length > 0) {
        // Separate vertices and edges based on structure
        vertices = [];
        edges = [];
        
        parsedLines.forEach(obj => {
          // Determine if it's a vertex or edge
          // Vertex indicators: has id/~id/_id but no outV/inV/~outV/~inV
          // Edge indicators: has outV/inV/~outV/~inV/_out/_in
          const hasVertexId = obj.id !== undefined || obj['~id'] !== undefined || obj._id !== undefined;
          const hasEdgeProps = obj.outV !== undefined || obj['~outV'] !== undefined || 
                               obj._outV !== undefined || obj._out !== undefined;
          
          if (hasEdgeProps) {
            edges.push(obj);
          } else if (hasVertexId) {
            vertices.push(obj);
          } else {
            // Ambiguous - try to infer from structure
            // If it has properties that look like edge properties, treat as edge
            if (obj.inV !== undefined || obj['~inV'] !== undefined || obj._inV !== undefined || obj._in !== undefined) {
              edges.push(obj);
            } else {
              // Default to vertex if ambiguous
              vertices.push(obj);
            }
          }
        });
        
        if (vertices.length === 0 && edges.length === 0) {
          throw new Error('Line-delimited GraphSON: No valid vertices or edges found');
        }
      } else {
        // Not line-delimited, parse as standard JSON
        graphson = JSON.parse(jsonData);
      }
    } else {
      // Standard JSON parsing
      graphson = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    }
    
    // If we haven't set vertices/edges yet, process standard GraphSON format
    if (!vertices || !edges) {
      // Validate GraphSON structure
      if (!graphson) {
        throw new Error('Invalid GraphSON: data is null or undefined');
      }
      
      // Handle different GraphSON formats
      // Format 1: Nested structure with graph.vertices and graph.edges
      if (graphson.graph) {
        vertices = graphson.graph.vertices;
        edges = graphson.graph.edges;
      }
      // Format 2: Top-level vertices and edges
      else if (graphson.vertices && graphson.edges) {
        vertices = graphson.vertices;
        edges = graphson.edges;
      }
      // Format 3: Direct arrays (legacy)
      else {
        vertices = graphson.V || graphson.vertices;
        edges = graphson.E || graphson.edges;
      }
    }
    
    // Ensure vertices and edges are arrays
    if (!vertices) vertices = [];
    if (!edges) edges = [];
    
    if (!Array.isArray(vertices)) {
      throw new Error('Invalid GraphSON: vertices is not an array');
    }
    
    if (!Array.isArray(edges)) {
      throw new Error('Invalid GraphSON: edges is not an array');
    }
    
    // Ensure dagobaGraph exists
    if (!window.dagobaGraph) {
      throw new Error('Dagoba graph is not initialized');
    }
    
    // Get existing vertex and edge IDs to prevent collisions
    const existingVertexIds = new Set(window.dagobaGraph.vertices.map(v => v._id));
    const existingEdgeIds = new Set();
    window.dagobaGraph.edges.forEach(e => {
      const edgeKey = `${e._out._id}_${e._in._id}_${e._label}`;
      existingEdgeIds.add(edgeKey);
    });
    
    // Find the highest numeric ID to start transforming from
    let maxNumericId = 0;
    existingVertexIds.forEach(id => {
      const numId = parseInt(id);
      if (!isNaN(numId) && numId > maxNumericId) {
        maxNumericId = numId;
      }
    });
    
    // Create ID mapping for imported vertices
    const idMap = new Map();
    let nextId = maxNumericId + 1;
    
    const importedVertices = vertices.map(v => {
      // Handle different vertex formats
      let originalId, vertexProps;
      
      // Check for id in various formats: id, _id, ~id (GraphSON 3.0)
      if (v.id !== undefined) {
        // Standard GraphSON format with id and properties
        originalId = v.id;
        vertexProps = v.properties || {};
      } else if (v['~id'] !== undefined) {
        // GraphSON 3.0 format with ~id
        originalId = v['~id'];
        vertexProps = v.properties || {};
      } else if (v._id !== undefined) {
        // Direct format with _id and direct properties
        originalId = v._id;
        vertexProps = {};
        Object.keys(v).forEach(key => {
          if (key !== '_id' && key !== '~id' && key !== '_type' && key !== '_in' && key !== '_out') {
            vertexProps[key] = v[key];
          }
        });
      } else {
        throw new Error('Vertex missing id, _id, or ~id property');
      }
      
      let newId = originalId;
      
      // Transform ID if collision detected
      if (existingVertexIds.has(String(originalId))) {
        // Generate new unique ID
        while (existingVertexIds.has(String(nextId)) || idMap.has(String(nextId))) {
          nextId++;
        }
        newId = nextId++;
        idMap.set(String(originalId), String(newId));
        console.log(`Transformed vertex ID: ${originalId} -> ${newId}`);
      } else {
        idMap.set(String(originalId), String(newId));
      }
      
      const vertex = { _id: String(newId) };
      
      // Extract properties from GraphSON format or direct format
      Object.keys(vertexProps).forEach(key => {
        if (vertexProps[key] !== undefined && vertexProps[key] !== null) {
          // Handle GraphSON property format: {key: [{id: ..., value: ...}]}
          if (Array.isArray(vertexProps[key]) && vertexProps[key].length > 0) {
            vertex[key] = vertexProps[key][0].value;
          } else {
            // Direct property value
            vertex[key] = vertexProps[key];
          }
        }
      });
      
      // Mark as imported
      vertex.imported = true;
      return vertex;
    });
    
    // Transform edge IDs using the vertex ID mapping
    const importedEdges = edges.map(e => {
      // Handle different edge formats
      let outV, inV, label;
      let edgeProps = {};
      
      // Check for GraphSON 3.0 format with ~outV, ~inV, ~label
      if (e['~outV'] !== undefined && e['~inV'] !== undefined) {
        outV = e['~outV'];
        inV = e['~inV'];
        label = e['~label'] || e.label || e._label || e.type || 'edge';
        // Extract properties from GraphSON 3.0 format
        if (e.properties) {
          edgeProps = e.properties;
        }
      }
      // Standard GraphSON format
      else if (e.outV !== undefined && e.inV !== undefined) {
        outV = e.outV;
        inV = e.inV;
        label = e.label || e['~label'] || e._label || e.type || 'edge';
        // Extract properties from standard GraphSON format
        if (e.properties) {
          edgeProps = e.properties;
        }
      }
      // Format with _outV and _inV
      else if (e._outV !== undefined && e._inV !== undefined) {
        outV = e._outV;
        inV = e._inV;
        label = e._label || e['~label'] || e.label || e.type || 'edge';
        // Extract direct properties (not in properties object)
        Object.keys(e).forEach(key => {
          if (key !== '_outV' && key !== '_inV' && key !== '_label' && 
              key !== '~outV' && key !== '~inV' && key !== '~label' &&
              key !== 'outV' && key !== 'inV' && key !== 'label' &&
              key !== '_id' && key !== '~id' && key !== '_type' &&
              key !== 'properties') {
            edgeProps[key] = e[key];
          }
        });
      }
      // Direct format
      else if (e._out !== undefined && e._in !== undefined) {
        outV = e._out;
        inV = e._in;
        label = e._label || e['~label'] || e.label || e.type || 'edge';
        // Extract direct properties
        Object.keys(e).forEach(key => {
          if (key !== '_out' && key !== '_in' && key !== '_label' &&
              key !== '~outV' && key !== '~inV' && key !== '~label' &&
              key !== 'outV' && key !== 'inV' && key !== 'label' &&
              key !== '_id' && key !== '~id' && key !== '_type' &&
              key !== 'properties') {
            edgeProps[key] = e[key];
          }
        });
      } else {
        console.warn('Edge missing outV/inV properties, skipping:', e);
        return null;
      }
      
      // Map vertex IDs using the transformation map
      const outId = idMap.get(String(outV)) || String(outV);
      const inId = idMap.get(String(inV)) || String(inV);
      const edgeKey = `${outId}_${inId}_${label}`;
      
      // Check for edge collision
      if (existingEdgeIds.has(edgeKey)) {
        console.warn(`Edge collision detected: ${edgeKey}, skipping`);
        return null;
      }
      
      // Build edge object with all properties
      const edge = {
        _out: outId,
        _in: inId,
        _label: label
      };
      
      // Add all edge properties, handling GraphSON property format
      Object.keys(edgeProps).forEach(key => {
        if (edgeProps[key] !== undefined && edgeProps[key] !== null) {
          // Handle GraphSON property format: {key: [{id: ..., value: ...}]}
          if (Array.isArray(edgeProps[key]) && edgeProps[key].length > 0) {
            // If it's an array of property objects, extract the value
            if (typeof edgeProps[key][0] === 'object' && edgeProps[key][0].value !== undefined) {
              edge[key] = edgeProps[key][0].value;
            } else {
              // If it's just an array of values, take the first one
              edge[key] = edgeProps[key][0];
            }
          } else {
            // Direct property value
            edge[key] = edgeProps[key];
          }
        }
      });
      
      return edge;
    }).filter(e => e !== null); // Remove null edges
    
    // Add imported vertices and edges to existing graph
    importedVertices.forEach(v => {
      try {
        window.dagobaGraph.addVertex(v);
      } catch (e) {
        console.warn('Error adding vertex:', v._id, e);
      }
    });
    
    importedEdges.forEach(e => {
      try {
        window.dagobaGraph.addEdge(e);
      } catch (err) {
        console.warn('Error adding edge:', e, err);
      }
    });
    
    renderDagobaToVis();
    saveGraph();
    alert(`GraphSON imported successfully! Added ${importedVertices.length} vertices and ${importedEdges.length} edges.`);
  } catch (e) {
    alert('Error importing GraphSON: ' + e.message);
    console.error('GraphSON import error:', e);
  }
};

// Import GraphSON from file
importGraphSONFromFile = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.graphson,application/json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file extension
    const fileName = file.name.toLowerCase();
    const isValidExtension = fileName.endsWith('.json') || fileName.endsWith('.graphson');
    if (!isValidExtension) {
      alert('Please select a .json or .graphson file');
      return;
    }
    
    const reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = readerEvent => {
      const content = readerEvent.target.result;
      importGraphSON(content);
    };
    reader.onerror = () => {
      alert('Error reading file');
    };
  };
  input.click();
};

// Show Gremlin help pane
showGremlinHelp = () => {
  // Add ESC key handler to close help
  $(document).on('keydown.gremlinHelp', function(e) {
    if (e.key === 'Escape' && $('#gremlin-help-panel').is(':visible')) {
      hideGremlinHelp();
    }
  });
  
  // Add click-outside handler
  $('#gremlin-help-panel').off('click').on('click', function(e) {
    if (e.target === this) {
      hideGremlinHelp();
    }
  });
  
  const helpContent = `
    <h4>Gremlin Query Language - Comprehensive Reference</h4>
    <p>This implementation supports a comprehensive subset of the Gremlin graph query language based on Apache TinkerPop. All queries must start with <code>v()</code> or <code>e()</code>.</p>
    
    <h5>1. Core Start Steps</h5>
    <table class="table table-bordered table-condensed">
      <thead>
        <tr>
          <th>Operation</th>
          <th>Description</th>
          <th>Example</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>v()</code></td>
          <td>Start query from all vertices</td>
          <td><code>v()</code></td>
        </tr>
        <tr>
          <td><code>v(id)</code></td>
          <td>Start from specific vertex by ID</td>
          <td><code>v("jesus")</code></td>
        </tr>
        <tr>
          <td><code>v({property: value})</code></td>
          <td>Start from vertices matching filter</td>
          <td><code>v({name: "Jesus Christ"})</code></td>
        </tr>
        <tr>
          <td><code>e()</code></td>
          <td>Start query from all edges</td>
          <td><code>e()</code></td>
        </tr>
        <tr>
          <td><code>e("label")</code></td>
          <td>Start from edges with specific label</td>
          <td><code>e("father")</code></td>
        </tr>
        <tr>
          <td><code>e({_label: "label"})</code></td>
          <td>Start from edges matching filter</td>
          <td><code>e({_label: "mother"})</code></td>
        </tr>
      </tbody>
    </table>
    
    <h5>2. Navigation Steps</h5>
    <table class="table table-bordered table-condensed">
      <thead>
        <tr>
          <th>Operation</th>
          <th>Description</th>
          <th>Example</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>out()</code></td>
          <td>Traverse to outgoing vertices</td>
          <td><code>v("jesus").out()</code></td>
        </tr>
        <tr>
          <td><code>out("label")</code></td>
          <td>Traverse outgoing edges with label</td>
          <td><code>v("jesus").out("father")</code></td>
        </tr>
        <tr>
          <td><code>in()</code></td>
          <td>Traverse to incoming vertices</td>
          <td><code>v("jesus").in()</code></td>
        </tr>
        <tr>
          <td><code>in("label")</code></td>
          <td>Traverse incoming edges with label</td>
          <td><code>v("jesus").in("mother")</code></td>
        </tr>
        <tr>
          <td><code>both()</code></td>
          <td>Traverse both directions</td>
          <td><code>v("david").both()</code></td>
        </tr>
        <tr>
          <td><code>both("label")</code></td>
          <td>Traverse both directions with label</td>
          <td><code>v("david").both("father")</code></td>
        </tr>
        <tr>
          <td><code>outE([labels])</code></td>
          <td>Outgoing edges</td>
          <td><code>v("jesus").outE("father")</code></td>
        </tr>
        <tr>
          <td><code>inE([labels])</code></td>
          <td>Incoming edges</td>
          <td><code>v("jesus").inE("mother")</code></td>
        </tr>
        <tr>
          <td><code>bothE([labels])</code></td>
          <td>Edges in both directions</td>
          <td><code>v("david").bothE()</code></td>
        </tr>
        <tr>
          <td><code>outV()</code></td>
          <td>From edge to outgoing vertex</td>
          <td><code>e().outV()</code></td>
        </tr>
        <tr>
          <td><code>inV()</code></td>
          <td>From edge to incoming vertex</td>
          <td><code>e().inV()</code></td>
        </tr>
        <tr>
          <td><code>bothV()</code></td>
          <td>From edge to both vertices (returns array)</td>
          <td><code>e().bothV()</code></td>
        </tr>
        <tr>
          <td><code>otherV()</code></td>
          <td>From edge to the "other" vertex</td>
          <td><code>e().otherV()</code></td>
        </tr>
      </tbody>
    </table>
    
    <h5>3. Filter Steps</h5>
    <table class="table table-bordered table-condensed">
      <thead>
        <tr>
          <th>Operation</th>
          <th>Description</th>
          <th>Example</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>has(key, value)</code></td>
          <td>Filter by property</td>
          <td><code>v().has("royal", true)</code></td>
        </tr>
        <tr>
          <td><code>has({key: value})</code></td>
          <td>Filter by multiple properties</td>
          <td><code>v().has({royal: true, generation: 20})</code></td>
        </tr>
        <tr>
          <td><code>hasLabel(label)</code></td>
          <td>Filter edges by label</td>
          <td><code>e().hasLabel("father")</code></td>
        </tr>
        <tr>
          <td><code>hasId(id)</code></td>
          <td>Filter by ID</td>
          <td><code>v().hasId("jesus")</code></td>
        </tr>
        <tr>
          <td><code>filter({property: value})</code></td>
          <td>Filter by property match</td>
          <td><code>v().filter({royal: true})</code></td>
        </tr>
        <tr>
          <td><code>filter(function(v) { ... })</code></td>
          <td>Filter using function</td>
          <td><code>v().filter(function(v) { return v.generation > 20 })</code></td>
        </tr>
        <tr>
          <td><code>where({property: value})</code></td>
          <td>Where clause filtering</td>
          <td><code>v().where({maternal: true})</code></td>
        </tr>
        <tr>
          <td><code>is(predicate)</code></td>
          <td>Simple predicate filter (supports predicates)</td>
          <td><code>v().values("generation").is(gt(20))</code></td>
        </tr>
        <tr>
          <td><code>has(key, predicate)</code></td>
          <td>Filter by property with predicate</td>
          <td><code>v().has("generation", gt(20))</code></td>
        </tr>
        <tr>
          <td><code>and(condition1, condition2, ...)</code></td>
          <td>Boolean AND</td>
          <td><code>v().and({royal: true}, {generation: 20})</code></td>
        </tr>
        <tr>
          <td><code>or(condition1, condition2, ...)</code></td>
          <td>Boolean OR</td>
          <td><code>v().or({royal: true}, {maternal: true})</code></td>
        </tr>
        <tr>
          <td><code>not(condition)</code></td>
          <td>Boolean NOT</td>
          <td><code>v().not({royal: true})</code></td>
        </tr>
        <tr>
          <td><code>simplePath()</code></td>
          <td>Ensure no repeated vertices in path</td>
          <td><code>v("abraham").out().out().simplePath()</code></td>
        </tr>
        <tr>
          <td><code>dedup()</code></td>
          <td>Remove duplicates</td>
          <td><code>v().out().dedup()</code></td>
        </tr>
      </tbody>
    </table>
    
    <h5>4. Map / Transform Steps</h5>
    <table class="table table-bordered table-condensed">
      <thead>
        <tr>
          <th>Operation</th>
          <th>Description</th>
          <th>Example</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>property("name")</code></td>
          <td>Get property value</td>
          <td><code>v("jesus").property("name")</code></td>
        </tr>
        <tr>
          <td><code>values([keys...])</code></td>
          <td>Extract property values</td>
          <td><code>v("jesus").values("name", "generation")</code></td>
        </tr>
        <tr>
          <td><code>id()</code></td>
          <td>Get vertex/edge ID</td>
          <td><code>v().id()</code></td>
        </tr>
        <tr>
          <td><code>label()</code></td>
          <td>Get edge label</td>
          <td><code>e().label()</code></td>
        </tr>
        <tr>
          <td><code>path()</code></td>
          <td>Get traversal path</td>
          <td><code>v("abraham").out().out().path()</code></td>
        </tr>
      </tbody>
    </table>
    
    <h5>5. Ordering & Pagination</h5>
    <table class="table table-bordered table-condensed">
      <thead>
        <tr>
          <th>Operation</th>
          <th>Description</th>
          <th>Example</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>order()</code></td>
          <td>Order results</td>
          <td><code>v().order()</code></td>
        </tr>
        <tr>
          <td><code>order().by("property")</code></td>
          <td>Order by property</td>
          <td><code>v().order().by("generation")</code></td>
        </tr>
        <tr>
          <td><code>take(n)</code></td>
          <td>Limit to first n items</td>
          <td><code>v().take(10)</code></td>
        </tr>
        <tr>
          <td><code>limit(n)</code></td>
          <td>Alias for take</td>
          <td><code>v().limit(5)</code></td>
        </tr>
        <tr>
          <td><code>skip(n)</code></td>
          <td>Skip first n items</td>
          <td><code>v().skip(5).take(10)</code></td>
        </tr>
        <tr>
          <td><code>range(start, end)</code></td>
          <td>Limit to range [start, end)</td>
          <td><code>v().range(5, 15)</code></td>
        </tr>
        <tr>
          <td><code>tail(n)</code></td>
          <td>Get last n items</td>
          <td><code>v().tail(5)</code></td>
        </tr>
      </tbody>
    </table>
    
    <h5>6. Aggregation Steps</h5>
    <table class="table table-bordered table-condensed">
      <thead>
        <tr>
          <th>Step</th>
          <th>Purpose</th>
          <th>Example</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>count()</code></td>
          <td>Count results</td>
          <td><code>v().count()</code></td>
        </tr>
        <tr>
          <td><code>sum([key])</code></td>
          <td>Sum numeric values</td>
          <td><code>v().values("generation").sum()</code></td>
        </tr>
        <tr>
          <td><code>min([key])</code></td>
          <td>Minimum value</td>
          <td><code>v().values("generation").min()</code></td>
        </tr>
        <tr>
          <td><code>max([key])</code></td>
          <td>Maximum value</td>
          <td><code>v().values("generation").max()</code></td>
        </tr>
        <tr>
          <td><code>mean([key])</code></td>
          <td>Average value</td>
          <td><code>v().values("generation").mean()</code></td>
        </tr>
        <tr>
          <td><code>avg([key])</code></td>
          <td>Alias for mean</td>
          <td><code>v().values("generation").avg()</code></td>
        </tr>
        <tr>
          <td><code>group([key])</code></td>
          <td>Group by key</td>
          <td><code>v().group("generation")</code></td>
        </tr>
        <tr>
          <td><code>groupCount([key])</code></td>
          <td>Group and count</td>
          <td><code>v().groupCount("generation")</code></td>
        </tr>
      </tbody>
    </table>
    
    <h5>7. Side-Effect Steps</h5>
    <table class="table table-bordered table-condensed">
      <thead>
        <tr>
          <th>Step</th>
          <th>Purpose</th>
          <th>Example</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>as("label")</code></td>
          <td>Label current step for later reference</td>
          <td><code>v("jesus").as("start").in()</code></td>
        </tr>
        <tr>
          <td><code>back("label")</code></td>
          <td>Go back to labeled step</td>
          <td><code>v("jesus").as("start").in().back("start")</code></td>
        </tr>
        <tr>
          <td><code>log()</code></td>
          <td>Log item to log pane (passes through unchanged)</td>
          <td><code>v().out().log()</code></td>
        </tr>
      </tbody>
    </table>
    
    <h5>8. Query Examples (Click to Copy)</h5>
    <div class="well" data-query='v({name: "Jesus Christ"})' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>Find Jesus:</strong><br>
      <code>v({name: "Jesus Christ"})</code>
    </div>
    <div class="well" data-query='v({name: "Jesus Christ"}).in().in().in()' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>All ancestors of Jesus:</strong><br>
      <code>v({name: "Jesus Christ"}).in().in().in()</code>
    </div>
    <div class="well" data-query='v().has("royal", true)' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>Royal line using has():</strong><br>
      <code>v().has("royal", true)</code>
    </div>
    <div class="well" data-query='v().has("generation", gt(20))' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>Generation greater than 20:</strong><br>
      <code>v().has("generation", gt(20))</code>
    </div>
    <div class="well" data-query='v().has("generation", between(10, 30))' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>Generation between 10 and 30:</strong><br>
      <code>v().has("generation", between(10, 30))</code>
    </div>
    <div class="well" data-query='v().filter({royal: true})' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>Royal line using filter():</strong><br>
      <code>v().filter({royal: true})</code>
    </div>
    <div class="well" data-query='v().filter({maternal: true})' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>Maternal links:</strong><br>
      <code>v().filter({maternal: true})</code>
    </div>
    <div class="well" data-query='e("father")' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>All father relationships:</strong><br>
      <code>e("father")</code>
    </div>
    <div class="well" data-query='v({name: "Abraham"}).out("father").out("father").out("father")' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>Path from Abraham to Jesus:</strong><br>
      <code>v({name: "Abraham"}).out("father").out("father").out("father")</code>
    </div>
    <div class="well" data-query='v().filter({royal: true}).order().by("generation")' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>Ordered by generation:</strong><br>
      <code>v().filter({royal: true}).order().by("generation")</code>
    </div>
    <div class="well" data-query='v().count()' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>Count all vertices:</strong><br>
      <code>v().count()</code>
    </div>
    <div class="well" data-query='v().values("generation").max()' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>Maximum generation:</strong><br>
      <code>v().values("generation").max()</code>
    </div>
    <div class="well" data-query='v().groupCount("generation")' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>Count by generation:</strong><br>
      <code>v().groupCount("generation")</code>
    </div>
    <div class="well" data-query='v().skip(5).take(10)' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>Pagination (skip 5, take 10):</strong><br>
      <code>v().skip(5).take(10)</code>
    </div>
    <div class="well" data-query='e().outV().has("royal", true)' onclick="copyToQueryEditor(this.getAttribute('data-query'))">
      <strong>Edges from royal vertices:</strong><br>
      <code>e().outV().has("royal", true)</code>
    </div>
    
    <h5>9. Notes</h5>
    <ul>
      <li>All queries are executed when you click "Execute" - no need to add <code>.run()</code></li>
      <li>Object filters use JSON syntax: <code>{property: value}</code></li>
      <li>String values can use single or double quotes</li>
      <li>Query results are highlighted in red on the graph</li>
      <li>Edge queries return edge objects and highlight connected vertices</li>
      <li>Aggregation steps (count, sum, min, max, mean, group, groupCount) consume all items and return a single result</li>
      <li>Steps work with both vertices and edges where applicable</li>
    </ul>
    
    <h5>10. Step Modulators</h5>
    <p>Modulators are used to modify steps:</p>
    <ul>
      <li><code>by()</code> - Used with <code>order()</code>, <code>group()</code>, etc. to specify the key or property</li>
      <li><code>as()</code> - Label traversers for later reference</li>
    </ul>
    
    <h5>11. Predicates</h5>
    <p>Predicates are helper functions used primarily in <code>has()</code>, <code>where()</code>, and <code>is()</code>:</p>
    <table class="table table-bordered table-condensed">
      <thead>
        <tr>
          <th>Predicate</th>
          <th>Description</th>
          <th>Example</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>eq(x)</code></td>
          <td>Equals</td>
          <td><code>v().has("generation", eq(20))</code></td>
        </tr>
        <tr>
          <td><code>neq(x)</code></td>
          <td>Not equals</td>
          <td><code>v().has("generation", neq(20))</code></td>
        </tr>
        <tr>
          <td><code>lt(x)</code></td>
          <td>Less than</td>
          <td><code>v().has("generation", lt(20))</code></td>
        </tr>
        <tr>
          <td><code>lte(x)</code></td>
          <td>Less than or equal</td>
          <td><code>v().has("generation", lte(20))</code></td>
        </tr>
        <tr>
          <td><code>gt(x)</code></td>
          <td>Greater than</td>
          <td><code>v().has("generation", gt(20))</code></td>
        </tr>
        <tr>
          <td><code>gte(x)</code></td>
          <td>Greater than or equal</td>
          <td><code>v().has("generation", gte(20))</code></td>
        </tr>
        <tr>
          <td><code>inside(a, b)</code></td>
          <td>Value is inside range (a &lt; value &lt; b)</td>
          <td><code>v().has("generation", inside(10, 30))</code></td>
        </tr>
        <tr>
          <td><code>outside(a, b)</code></td>
          <td>Value is outside range (value &lt; a || value &gt; b)</td>
          <td><code>v().has("generation", outside(10, 30))</code></td>
        </tr>
        <tr>
          <td><code>between(a, b)</code></td>
          <td>Value is between a and b (a &lt;= value &lt;= b)</td>
          <td><code>v().has("generation", between(10, 30))</code></td>
        </tr>
        <tr>
          <td><code>within(collection)</code></td>
          <td>Value is in collection</td>
          <td><code>v().has("name", within(["Jesus", "David", "Abraham"]))</code></td>
        </tr>
        <tr>
          <td><code>without(collection)</code></td>
          <td>Value is not in collection</td>
          <td><code>v().has("name", without(["Jesus", "David"]))</code></td>
        </tr>
      </tbody>
    </table>
    <p><strong>Usage examples:</strong></p>
    <ul>
      <li><code>v().has("generation", gt(20))</code> - Vertices with generation greater than 20</li>
      <li><code>v().values("generation").is(lt(30))</code> - Generation values less than 30</li>
      <li><code>v().has("generation", between(10, 30))</code> - Generation between 10 and 30 (inclusive)</li>
      <li><code>v().has("name", within(["Jesus", "David"]))</code> - Names in the list</li>
    </ul>
    
    <h5>12. Reference</h5>
    <p>This implementation is based on Apache TinkerPop's Gremlin. For the complete reference, see:</p>
    <ul>
      <li><a href="https://tinkerpop.apache.org/docs/current/reference/" target="_blank">TinkerPop Reference Documentation</a></li>
      <li>Not all TinkerPop steps are implemented - this is a focused subset for in-memory graph queries</li>
    </ul>
  `;
  
  $('#gremlin-help-content').html(helpContent);
  $('#gremlin-help-panel').show();
};

// Hide Gremlin help pane
hideGremlinHelp = () => {
  $('#gremlin-help-panel').hide();
  // Remove ESC key handler
  $(document).off('keydown.gremlinHelp');
};

// Copy query example to editor
copyToQueryEditor = (query) => {
  $('#query-editor').val(query);
  $('#gremlin-help-panel').hide();
  // Focus on the editor
  setTimeout(() => {
    $('#query-editor').focus();
  }, 100);
};

