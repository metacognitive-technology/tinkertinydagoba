// Tab Manager and Script Library for TinkerTiny
// Manages multiple editor tabs, each with its own graph, queries, and visualization

window.TabManager = {
  tabs: [],
  activeTabId: null,
  scriptLibrary: [],
  categories: [],
  selectedCategory: 'all',
  currentEditingScript: null,
  
  init: function() {
    // Load tabs from localStorage
    const savedTabs = localStorage.getItem('tinkertiny_tabs');
    if (savedTabs) {
      try {
        this.tabs = JSON.parse(savedTabs);
      } catch (e) {
        console.error('Error loading tabs:', e);
        this.tabs = [];
      }
    }
    
    // Load script library from localStorage
    const savedScripts = localStorage.getItem('tinkertiny_script_library');
    if (savedScripts) {
      try {
        const data = JSON.parse(savedScripts);
        this.scriptLibrary = data.scripts || [];
        this.categories = data.categories || [];
      } catch (e) {
        console.error('Error loading script library:', e);
        this.scriptLibrary = [];
        this.categories = [];
      }
    }
    
    // Initialize default categories and example scripts if library is empty
    if (this.scriptLibrary.length === 0) {
      this.initializeDefaultScripts();
    }
    
    // Create default tab if none exist
    if (this.tabs.length === 0) {
      this.createTab('Tab 1');
    }
    
    // Set active tab
    this.activeTabId = this.tabs[0].id;
    
    // Render tabs
    this.renderTabs();
    this.switchToTab(this.activeTabId);
  },
  
  initializeDefaultScripts: function() {
    // Define default categories
    this.categories = [
      { id: 'genealogy', name: 'Genealogy', description: 'Scripts for genealogy graph queries' },
      { id: 'interstate', name: 'Interstate', description: 'Scripts for interstate/highway graph queries' },
      { id: 'random', name: 'Random Graph', description: 'Scripts for querying randomly generated graphs' },
      { id: 'general', name: 'General', description: 'General purpose graph queries' }
    ];
    
    // Genealogy examples
    const genealogyScripts = [
      { name: 'Find Jesus', query: 'v({name: "Jesus Christ"})', description: 'Find vertex by name' },
      { name: 'All ancestors of Jesus', query: 'v({name: "Jesus Christ"}).in().in().in()', description: 'Traverse up the family tree' },
      { name: 'Royal line', query: 'v().has("royal", true)', description: 'Filter by property using has()' },
      { name: 'Royal line (filter)', query: 'v().filter({royal: true})', description: 'Filter by property using filter()' },
      { name: 'Maternal links', query: 'v().filter({maternal: true})', description: 'Find maternal relationships' },
      { name: 'Generation > 20', query: 'v().has("generation", gt(20))', description: 'Use predicate for comparison' },
      { name: 'Generation range', query: 'v().has("generation", between(10, 30))', description: 'Use between predicate' },
      { name: 'All father relationships', query: 'e("father")', description: 'Query edges by label' },
      { name: 'Path from Abraham', query: 'v({name: "Abraham"}).out("father").out("father").out("father")', description: 'Traverse specific path' },
      { name: 'Ordered by generation', query: 'v().filter({royal: true}).order().by("generation")', description: 'Sort results' },
      { name: 'Count vertices', query: 'v().count()', description: 'Count aggregation' },
      { name: 'Max generation', query: 'v().values("generation").max()', description: 'Find maximum value' },
      { name: 'Count by generation', query: 'v().groupCount("generation")', description: 'Group and count' },
      { name: 'Pagination', query: 'v().skip(5).take(10)', description: 'Skip and limit results' },
      { name: 'Edges from royal vertices', query: 'e().outV().has("royal", true)', description: 'Query edges from filtered vertices' },
      { name: 'Get property values', query: 'v("jesus").values("name", "generation")', description: 'Extract property values' },
      { name: 'Get vertex ID', query: 'v().id()', description: 'Get vertex IDs' },
      { name: 'Get edge labels', query: 'e().label()', description: 'Get edge labels' },
      { name: 'Get traversal path', query: 'v("abraham").out().out().path()', description: 'Get full traversal path' },
      { name: 'Deduplicate results', query: 'v().out().dedup()', description: 'Remove duplicates' },
      { name: 'Simple path only', query: 'v("abraham").out().out().simplePath()', description: 'Ensure no repeated vertices' },
      { name: 'Sum generations', query: 'v().values("generation").sum()', description: 'Sum numeric values' },
      { name: 'Min generation', query: 'v().values("generation").min()', description: 'Find minimum value' },
      { name: 'Average generation', query: 'v().values("generation").mean()', description: 'Calculate average' },
      { name: 'Group by generation', query: 'v().group("generation")', description: 'Group vertices by property' },
      { name: 'Range query', query: 'v().range(5, 15)', description: 'Get items in range' },
      { name: 'Last 5 items', query: 'v().tail(5)', description: 'Get last n items' },
      { name: 'Both directions', query: 'v("david").both()', description: 'Traverse both incoming and outgoing' },
      { name: 'Outgoing edges', query: 'v("jesus").outE("father")', description: 'Get outgoing edges' },
      { name: 'Incoming edges', query: 'v("jesus").inE("mother")', description: 'Get incoming edges' },
      { name: 'Edge to vertex', query: 'e().outV()', description: 'Get source vertex from edge' },
      { name: 'Edge to target', query: 'e().inV()', description: 'Get target vertex from edge' },
      { name: 'Other vertex', query: 'e().otherV()', description: 'Get the other vertex from edge' }
    ];
    
    // Interstate examples
    const interstateScripts = [
      { name: 'All interstates', query: 'v().has("label", "interstate")', description: 'Find all interstate vertices (if label property exists)' },
      { name: 'All cities', query: 'v().has("label", "city")', description: 'Find all city vertices (if label property exists)' },
      { name: 'Interstate I-5', query: 'v({name: "I-5"})', description: 'Find specific interstate' },
      { name: 'Cities on I-5', query: 'v({name: "I-5"}).both("connects")', description: 'Find cities connected to I-5' },
      { name: 'East-West interstates', query: 'v().has("direction", "E-W")', description: 'Filter by direction property' },
      { name: 'North-South interstates', query: 'v().has("direction", "N-S")', description: 'Filter N-S interstates' },
      { name: 'Interstate number > 50', query: 'v().has("number", gt(50))', description: 'Use predicate on numeric property' },
      { name: 'Cities in California', query: 'v().has("state", "CA")', description: 'Filter cities by state' },
      { name: 'Cities with latitude', query: 'v().has("latitude", gt(35))', description: 'Filter by geographic property' },
      { name: 'All connections', query: 'e("connects")', description: 'Get all connection edges' },
      { name: 'Count interstates', query: 'v().has("label", "interstate").count()', description: 'Count interstates' },
      { name: 'Count cities', query: 'v().has("label", "city").count()', description: 'Count cities' },
      { name: 'Max interstate number', query: 'v().has("label", "interstate").values("number").max()', description: 'Find highest interstate number' },
      { name: 'Group by state', query: 'v().has("label", "city").group("state")', description: 'Group cities by state' },
      { name: 'Count by state', query: 'v().has("label", "city").groupCount("state")', description: 'Count cities per state' },
      { name: 'Order by number', query: 'v().has("label", "interstate").order().by("number")', description: 'Sort interstates by number' },
      { name: 'Path between cities', query: 'v({name: "Los Angeles"}).out("connects").out("connects")', description: 'Find paths between cities' },
      { name: 'Cities connected to interstate', query: 'v().has("label", "interstate").both("connects")', description: 'Find cities on any interstate' },
      { name: 'Interstate labels', query: 'e("connects").label()', description: 'Get edge labels' },
      { name: 'City properties', query: 'v().has("label", "city").values("name", "state", "latitude", "longitude")', description: 'Get multiple city properties' }
    ];
    
    // Random graph examples
    const randomGraphScripts = [
      { name: 'All persons', query: 'v().has("type", "person")', description: 'Find all person vertices' },
      { name: 'All entities', query: 'v().has("type", "entity")', description: 'Find all entity vertices' },
      { name: 'People with age', query: 'v().has("age")', description: 'Find vertices with age property' },
      { name: 'Age > 30', query: 'v().has("age", gt(30))', description: 'Find people older than 30' },
      { name: 'Age range', query: 'v().has("age", between(25, 50))', description: 'Find people between 25 and 50' },
      { name: 'High score', query: 'v().has("score", gt(80))', description: 'Find vertices with score > 80' },
      { name: 'Top level', query: 'v().has("level", gt(5))', description: 'Find vertices with level > 5' },
      { name: 'Knows relationships', query: 'e("knows")', description: 'Get all "knows" edges' },
      { name: 'Follows relationships', query: 'e("follows")', description: 'Get all "follows" edges' },
      { name: 'Friends network', query: 'e("friend")', description: 'Get all "friend" edges' },
      { name: 'People who know others', query: 'v().has("type", "person").out("knows")', description: 'Find people connected via knows' },
      { name: 'Followers', query: 'v().has("type", "person").in("follows")', description: 'Find who follows a person' },
      { name: 'Friends of friends', query: 'v().has("type", "person").out("friend").out("friend")', description: 'Find friends of friends' },
      { name: 'Count all vertices', query: 'v().count()', description: 'Count total vertices' },
      { name: 'Count persons', query: 'v().has("type", "person").count()', description: 'Count person vertices' },
      { name: 'Count edges', query: 'e().count()', description: 'Count total edges' },
      { name: 'Average age', query: 'v().values("age").mean()', description: 'Calculate average age' },
      { name: 'Max age', query: 'v().values("age").max()', description: 'Find maximum age' },
      { name: 'Min age', query: 'v().values("age").min()', description: 'Find minimum age' },
      { name: 'Average score', query: 'v().values("score").mean()', description: 'Calculate average score' },
      { name: 'Group by type', query: 'v().group("type")', description: 'Group vertices by type' },
      { name: 'Count by type', query: 'v().groupCount("type")', description: 'Count vertices by type' },
      { name: 'Age distribution', query: 'v().groupCount("age")', description: 'Count vertices by age' },
      { name: 'Order by age', query: 'v().has("age").order().by("age")', description: 'Sort by age' },
      { name: 'Order by score', query: 'v().has("score").order().by("score")', description: 'Sort by score' },
      { name: 'Top 10 by score', query: 'v().has("score").order().by("score").tail(10)', description: 'Get top 10 scores' },
      { name: 'Youngest 5', query: 'v().has("age").order().by("age").take(5)', description: 'Get 5 youngest' },
      { name: 'All connections', query: 'v().both()', description: 'Get all connected vertices' },
      { name: 'Outgoing connections', query: 'v().out()', description: 'Get outgoing connections' },
      { name: 'Incoming connections', query: 'v().in()', description: 'Get incoming connections' },
      { name: 'Multiple properties', query: 'v().has("age").has("score")', description: 'Find vertices with both age and score' },
      { name: 'High level and score', query: 'v().has("level", gt(5)).has("score", gt(70))', description: 'Find high level and high score' },
      { name: 'Edge labels', query: 'e().label()', description: 'Get all edge labels' },
      { name: 'Edge weights', query: 'e().has("weight")', description: 'Find edges with weight property' },
      { name: 'Strong connections', query: 'e().has("strength", gt(5))', description: 'Find strong connections' },
      { name: 'Path between persons', query: 'v().has("type", "person").out().out()', description: 'Find 2-hop paths from persons' },
      { name: 'Isolated vertices', query: 'v().not(both())', description: 'Find vertices with no connections' },
      { name: 'Well connected', query: 'v().where(both().count().is(gt(5)))', description: 'Find vertices with >5 connections' }
    ];
    
    // General examples
    const generalScripts = [
      { name: 'All vertices', query: 'v()', description: 'Get all vertices' },
      { name: 'All edges', query: 'e()', description: 'Get all edges' },
      { name: 'Vertex by ID', query: 'v("vertex_id")', description: 'Get vertex by ID' },
      { name: 'Edges by label', query: 'e("label_name")', description: 'Get edges by label' },
      { name: 'Outgoing neighbors', query: 'v("id").out()', description: 'Get outgoing neighbors' },
      { name: 'Incoming neighbors', query: 'v("id").in()', description: 'Get incoming neighbors' },
      { name: 'Filter by object', query: 'v().filter({property: "value"})', description: 'Filter using object' },
      { name: 'Filter by function', query: 'v().filter(function(v) { return v.property > 10 })', description: 'Filter using function' },
      { name: 'Where clause', query: 'v().where({property: "value"})', description: 'Use where for filtering' },
      { name: 'Is predicate', query: 'v().values("property").is(gt(10))', description: 'Use is() with predicate' },
      { name: 'And condition', query: 'v().and({prop1: true}, {prop2: "value"})', description: 'Multiple AND conditions' },
      { name: 'Or condition', query: 'v().or({prop1: true}, {prop2: true})', description: 'Multiple OR conditions' },
      { name: 'Not condition', query: 'v().not({property: "value"})', description: 'NOT condition' },
      { name: 'Property value', query: 'v("id").property("name")', description: 'Get single property' },
      { name: 'Get ID', query: 'v().id()', description: 'Get vertex/edge IDs' },
      { name: 'Limit results', query: 'v().take(10)', description: 'Limit to first n' },
      { name: 'Skip results', query: 'v().skip(5)', description: 'Skip first n' },
      { name: 'Sum values', query: 'v().values("property").sum()', description: 'Sum property values' },
      { name: 'Min value', query: 'v().values("property").min()', description: 'Find minimum' },
      { name: 'Mean value', query: 'v().values("property").mean()', description: 'Calculate mean' },
      { name: 'Group by property', query: 'v().group("property")', description: 'Group by property' },
      { name: 'Group count', query: 'v().groupCount("property")', description: 'Group and count' }
    ];
    
    // Add all scripts with categories
    genealogyScripts.forEach(script => {
      this.scriptLibrary.push({
        ...script,
        id: 'script_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        category: 'genealogy',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    
    interstateScripts.forEach(script => {
      this.scriptLibrary.push({
        ...script,
        id: 'script_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        category: 'interstate',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    
    randomGraphScripts.forEach(script => {
      this.scriptLibrary.push({
        ...script,
        id: 'script_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        category: 'random',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    
    generalScripts.forEach(script => {
      this.scriptLibrary.push({
        ...script,
        id: 'script_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        category: 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    
    this.saveScriptLibrary();
  },
  
  createTab: function(name) {
    // Save current tab state before creating new one
    if (this.activeTabId) {
      this.saveCurrentTabState();
    }
    
    const tab = {
      id: 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: name || 'New Tab',
      query: '',
      savedQueries: [],
      graphData: { V: [], E: [] },
      queryResults: null,
      highlightNodes: [],
      highlightEdges: []
    };
    
    this.tabs.push(tab);
    this.saveTabs(); // Just save tabs array, don't save state again
    this.renderTabs();
    this.switchToTab(tab.id);
    
    return tab.id;
  },
  
  removeTab: function(tabId) {
    if (this.tabs.length <= 1) {
      alert('Cannot remove the last tab. Create a new tab first.');
      return;
    }
    
    if (!confirm('Are you sure you want to remove this tab?')) {
      return;
    }
    
    // Save current tab state before removing
    if (this.activeTabId) {
      this.saveCurrentTabState();
    }
    
    this.tabs = this.tabs.filter(t => t.id !== tabId);
    
    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs[0].id;
    }
    
    this.saveTabs();
    this.renderTabs();
    this.switchToTab(this.activeTabId);
  },
  
  renameTab: function(tabId, newName) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.name = newName || 'Unnamed Tab';
      this.saveTabs();
      this.renderTabs();
    }
  },
  
  switchToTab: function(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    // Save current tab state before switching (only if we have an active tab)
    if (this.activeTabId && this.activeTabId !== tabId) {
      this.saveCurrentTabState();
    }
    
    this.activeTabId = tabId;
    
    // Load tab state
    this.loadTabState(tab);
    
    // Update UI
    this.updateTabButtons();
    this.renderTabs();
    
    // Save tabs after loading state
    this.saveTabs();
    
    // Re-render graph
    if (window.dagobaGraph && typeof renderDagobaToVis === 'function') {
      renderDagobaToVis();
      if (tab.queryResults) {
        setTimeout(() => {
          updateQueryHighlights(tab.highlightNodes || [], tab.highlightEdges || []);
        }, 100);
      }
    }
  },
  
  saveCurrentTabState: function() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab) return;
    
    // Save query editor content
    const queryEditor = document.getElementById('query-editor');
    if (queryEditor) {
      tab.query = queryEditor.value;
    }
    
    // Save graph data
    if (window.dagobaGraph) {
      // Helper to safely get ID from vertex reference
      const getVertexId = (vertexRef) => {
        if (!vertexRef) return null;
        if (typeof vertexRef === 'string') return vertexRef;
        if (typeof vertexRef === 'number') return String(vertexRef);
        if (vertexRef._id) return vertexRef._id;
        if (Array.isArray(vertexRef) && vertexRef.length > 0) {
          // Handle array of vertices - get first one's ID
          return getVertexId(vertexRef[0]);
        }
        return null;
      };
      
      tab.graphData = {
        V: window.dagobaGraph.vertices.map(v => {
          const clean = {};
          Object.keys(v).forEach(key => {
            // Skip internal references that might have circular refs
            if (key !== '_in' && key !== '_out') {
              const value = v[key];
              // Skip any values that are objects with circular refs
              if (typeof value === 'object' && value !== null) {
                // Only include simple objects, not vertex/edge references
                if (!value._id && !value._out && !value._in) {
                  try {
                    // Try to serialize - if it fails, skip it
                    JSON.stringify(value);
                    clean[key] = value;
                  } catch (e) {
                    // Skip circular references
                  }
                }
              } else {
                clean[key] = value;
              }
            }
          });
          return clean;
        }),
        E: window.dagobaGraph.edges.map(e => {
          const edgeData = {
            _out: getVertexId(e._out),
            _in: getVertexId(e._in),
            _label: e._label || 'edge'
          };
          
          // Add other edge properties (excluding circular references)
          Object.keys(e).forEach(key => {
            if (key !== '_id' && key !== '_in' && key !== '_out' && key !== '_label') {
              const value = e[key];
              // Only include non-circular values
              if (typeof value !== 'object' || value === null) {
                edgeData[key] = value;
              } else if (Array.isArray(value)) {
                // Arrays are usually safe
                try {
                  JSON.stringify(value);
                  edgeData[key] = value;
                } catch (e) {
                  // Skip if circular
                }
              } else {
                // Check if it's a simple object without circular refs
                try {
                  JSON.stringify(value);
                  edgeData[key] = value;
                } catch (e) {
                  // Skip circular references
                }
              }
            }
          });
          
          return edgeData;
        })
      };
    }
    
    // Save query results (clean to avoid circular references)
    if (window.queryResults) {
      // Create a safe copy of query results without circular references
      const safeResults = {
        nodes: window.queryResults.nodes || [],
        edges: (window.queryResults.edges || []).map(e => {
          // If edge is an object, extract just the IDs
          if (typeof e === 'object' && e !== null) {
            return {
              _out: typeof e._out === 'string' ? e._out : (e._out?._id || e._out),
              _in: typeof e._in === 'string' ? e._in : (e._in?._id || e._in),
              _label: e._label || 'edge'
            };
          }
          return e;
        }),
        results: (window.queryResults.results || []).map(r => {
          // Clean result objects to avoid circular refs
          if (typeof r === 'object' && r !== null) {
            try {
              // Try to create a safe copy
              if (r._id) {
                return { _id: r._id, name: r.name || null };
              }
              if (r._out && r._in) {
                return {
                  _out: typeof r._out === 'string' ? r._out : (r._out?._id || r._out),
                  _in: typeof r._in === 'string' ? r._in : (r._in?._id || r._in),
                  _label: r._label || 'edge'
                };
              }
              // For other objects, try to serialize safely
              const safe = {};
              Object.keys(r).forEach(key => {
                if (key !== '_out' && key !== '_in' && typeof r[key] !== 'object') {
                  safe[key] = r[key];
                }
              });
              return safe;
            } catch (e) {
              return null; // Skip if can't serialize
            }
          }
          return r;
        }).filter(r => r !== null)
      };
      
      tab.queryResults = safeResults;
      tab.highlightNodes = safeResults.nodes;
      tab.highlightEdges = safeResults.edges;
    }
    
    // Save saved queries
    if (window.savedQueries) {
      tab.savedQueries = window.savedQueries;
    }
    
    this.saveTabs();
  },
  
  loadTabState: function(tab) {
    // Load query editor
    const queryEditor = document.getElementById('query-editor');
    if (queryEditor) {
      queryEditor.value = tab.query || '';
    }
    
    // Load graph
    if (window.dagobaGraph && tab.graphData) {
      window.dagobaGraph = Dagoba.graph(tab.graphData.V || [], tab.graphData.E || []);
    }
    
    // Load saved queries
    if (tab.savedQueries) {
      window.savedQueries = tab.savedQueries;
      if (typeof renderSavedQueries === 'function') {
        renderSavedQueries();
      }
    }
    
    // Load query results
    if (tab.queryResults) {
      window.queryResults = tab.queryResults;
    } else {
      window.queryResults = null;
    }
    
    // Update query results display
    if (typeof updateQueryResultsDisplay === 'function') {
      updateQueryResultsDisplay();
    }
  },
  
  renderTabs: function() {
    const container = document.getElementById('tab-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    this.tabs.forEach(tab => {
      const tabElement = document.createElement('div');
      tabElement.className = 'tab-item' + (tab.id === this.activeTabId ? ' active' : '');
      tabElement.innerHTML = `
        <span class="tab-name" data-tab-id="${tab.id}">${tab.name}</span>
        <button class="btn btn-xs btn-default rename-tab-btn" data-tab-id="${tab.id}" title="Rename">✎</button>
        <button class="btn btn-xs btn-danger remove-tab-btn" data-tab-id="${tab.id}" title="Remove">×</button>
      `;
      
      // Click to switch tab
      tabElement.querySelector('.tab-name').addEventListener('click', () => {
        this.switchToTab(tab.id);
      });
      
      // Rename button
      tabElement.querySelector('.rename-tab-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const newName = prompt('Enter new tab name:', tab.name);
        if (newName && newName.trim()) {
          this.renameTab(tab.id, newName.trim());
        }
      });
      
      // Remove button
      tabElement.querySelector('.remove-tab-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTab(tab.id);
      });
      
      container.appendChild(tabElement);
    });
    
    // Add "New Tab" button
    const newTabBtn = document.createElement('button');
    newTabBtn.className = 'btn btn-xs btn-success';
    newTabBtn.textContent = '+ New Tab';
    newTabBtn.onclick = () => {
      const name = prompt('Enter tab name:', 'Tab ' + (this.tabs.length + 1));
      this.createTab(name || 'New Tab');
    };
    container.appendChild(newTabBtn);
    
    // Update tab selector for query results
    this.updateTabSelector();
  },
  
  updateTabSelector: function() {
    const selector = document.getElementById('result-tab-select');
    if (!selector) return;
    
    selector.innerHTML = '<option value="current">Current Tab</option>';
    this.tabs.forEach(tab => {
      const option = document.createElement('option');
      option.value = tab.id;
      option.textContent = tab.name;
      if (tab.id === this.activeTabId) {
        option.selected = true;
      }
      selector.appendChild(option);
    });
  },
  
  updateTabButtons: function() {
    // Update any tab-specific UI elements
  },
  
  saveTabs: function() {
    // Just save the tabs array to localStorage
    // Don't call saveCurrentTabState() here to avoid recursion
    // Clean tabs to avoid circular references
    try {
      const cleanedTabs = this.tabs.map(tab => {
        const cleaned = {
          id: tab.id,
          name: tab.name,
          query: tab.query || '',
          savedQueries: tab.savedQueries || [],
          // Clean graphData to avoid circular references
          graphData: this.cleanGraphData(tab.graphData),
          // Clean queryResults to avoid circular references
          queryResults: this.cleanQueryResults(tab.queryResults),
          highlightNodes: tab.highlightNodes || [],
          highlightEdges: (tab.highlightEdges || []).map(e => {
            if (typeof e === 'object' && e !== null) {
              return {
                _out: typeof e._out === 'string' ? e._out : (e._out?._id || e._out),
                _in: typeof e._in === 'string' ? e._in : (e._in?._id || e._in),
                _label: e._label || 'edge'
              };
            }
            return e;
          })
        };
        return cleaned;
      });
      localStorage.setItem('tinkertiny_tabs', JSON.stringify(cleanedTabs));
    } catch (e) {
      console.error('Error saving tabs:', e);
      // Fallback: try to save without graphData
      const safeTabs = this.tabs.map(tab => ({
        id: tab.id,
        name: tab.name,
        query: tab.query || '',
        savedQueries: tab.savedQueries || []
      }));
      localStorage.setItem('tinkertiny_tabs', JSON.stringify(safeTabs));
    }
  },
  
  cleanGraphData: function(graphData) {
    if (!graphData) return null;
    
    try {
      // Helper to safely get ID from vertex reference
      const getVertexId = (vertexRef) => {
        if (!vertexRef) return null;
        if (typeof vertexRef === 'string') return vertexRef;
        if (typeof vertexRef === 'number') return String(vertexRef);
        if (vertexRef._id) return vertexRef._id;
        if (Array.isArray(vertexRef) && vertexRef.length > 0) {
          return getVertexId(vertexRef[0]);
        }
        return null;
      };
      
      const cleaned = {
        V: (graphData.V || []).map(v => {
          const clean = {};
          Object.keys(v).forEach(key => {
            if (key !== '_in' && key !== '_out') {
              const value = v[key];
              if (typeof value === 'object' && value !== null) {
                if (!value._id && !value._out && !value._in) {
                  try {
                    JSON.stringify(value);
                    clean[key] = value;
                  } catch (e) {
                    // Skip circular references
                  }
                }
              } else {
                clean[key] = value;
              }
            }
          });
          return clean;
        }),
        E: (graphData.E || []).map(e => {
          const edgeData = {
            _out: getVertexId(e._out),
            _in: getVertexId(e._in),
            _label: e._label || 'edge'
          };
          
          Object.keys(e).forEach(key => {
            if (key !== '_id' && key !== '_in' && key !== '_out' && key !== '_label') {
              const value = e[key];
              if (typeof value !== 'object' || value === null) {
                edgeData[key] = value;
              } else if (Array.isArray(value)) {
                try {
                  JSON.stringify(value);
                  edgeData[key] = value;
                } catch (e) {
                  // Skip if circular
                }
              } else {
                try {
                  JSON.stringify(value);
                  edgeData[key] = value;
                } catch (e) {
                  // Skip circular references
                }
              }
            }
          });
          
          return edgeData;
        })
      };
      
      return cleaned;
    } catch (e) {
      console.error('Error cleaning graph data:', e);
      return null;
    }
  },
  
  cleanQueryResults: function(queryResults) {
    if (!queryResults) return null;
    
    try {
      const safeResults = {
        nodes: queryResults.nodes || [],
        edges: (queryResults.edges || []).map(e => {
          if (typeof e === 'object' && e !== null) {
            return {
              _out: typeof e._out === 'string' ? e._out : (e._out?._id || e._out),
              _in: typeof e._in === 'string' ? e._in : (e._in?._id || e._in),
              _label: e._label || 'edge'
            };
          }
          return e;
        }),
        results: (queryResults.results || []).map(r => {
          if (typeof r === 'object' && r !== null) {
            try {
              if (r._id) {
                return { _id: r._id, name: r.name || null };
              }
              if (r._out && r._in) {
                return {
                  _out: typeof r._out === 'string' ? r._out : (r._out?._id || r._out),
                  _in: typeof r._in === 'string' ? r._in : (r._in?._id || r._in),
                  _label: r._label || 'edge'
                };
              }
              const safe = {};
              Object.keys(r).forEach(key => {
                if (key !== '_out' && key !== '_in' && typeof r[key] !== 'object') {
                  safe[key] = r[key];
                }
              });
              return safe;
            } catch (e) {
              return null;
            }
          }
          return r;
        }).filter(r => r !== null)
      };
      
      return safeResults;
    } catch (e) {
      console.error('Error cleaning query results:', e);
      return null;
    }
  },
  
  // Script Library Functions
  saveToScriptLibrary: function(name, query, description, category) {
    const script = {
      id: 'script_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: name || 'Unnamed Script',
      query: query || '',
      description: description || '',
      category: category || this.selectedCategory || 'general',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.scriptLibrary.push(script);
    this.saveScriptLibrary();
    return script.id;
  },
  
  createCategory: function(name, description) {
    const category = {
      id: 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: name || 'Unnamed Category',
      description: description || '',
      createdAt: new Date().toISOString()
    };
    
    this.categories.push(category);
    this.saveScriptLibrary();
    return category.id;
  },
  
  deleteCategory: function(categoryId) {
    // Move scripts in this category to 'general'
    this.scriptLibrary.forEach(script => {
      if (script.category === categoryId) {
        script.category = 'general';
      }
    });
    
    this.categories = this.categories.filter(c => c.id !== categoryId);
    this.saveScriptLibrary();
  },
  
  getScriptsByCategory: function(categoryId) {
    if (categoryId === 'all') {
      return this.scriptLibrary;
    }
    return this.scriptLibrary.filter(s => s.category === categoryId);
  },
  
  loadFromScriptLibrary: function(scriptId) {
    const script = this.scriptLibrary.find(s => s.id === scriptId);
    if (script) {
      const queryEditor = document.getElementById('query-editor');
      if (queryEditor) {
        queryEditor.value = script.query;
      }
      
      
      return script;
    }
    return null;
  },
  
  deleteFromScriptLibrary: function(scriptId) {
    this.scriptLibrary = this.scriptLibrary.filter(s => s.id !== scriptId);
    this.saveScriptLibrary();
  },
  
  renderScriptLibrary: function() {
    const container = document.getElementById('script-library-list');
    if (!container) return;
    
    // Render category selector
    const categorySelector = document.getElementById('script-category-select');
    if (categorySelector) {
      categorySelector.innerHTML = '<option value="all">All Categories</option>';
      this.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        if (cat.id === this.selectedCategory) {
          option.selected = true;
        }
        categorySelector.appendChild(option);
      });
      
      // Add "New Category" option
      const newCatOption = document.createElement('option');
      newCatOption.value = '__new__';
      newCatOption.textContent = '+ New Category...';
      categorySelector.appendChild(newCatOption);
      
      categorySelector.onchange = (e) => {
        if (e.target.value === '__new__') {
          const name = prompt('Enter category name:');
          if (name && name.trim()) {
            const desc = prompt('Enter category description (optional):');
            this.createCategory(name.trim(), desc || '');
            this.selectedCategory = this.categories[this.categories.length - 1].id;
            this.renderScriptLibrary();
          } else {
            e.target.value = this.selectedCategory;
          }
        } else {
          this.selectedCategory = e.target.value;
          this.renderScriptLibrary();
        }
      };
    }
    
    container.innerHTML = '';
    
    // Get scripts for selected category
    const scripts = this.getScriptsByCategory(this.selectedCategory);
    
    if (scripts.length === 0) {
      container.innerHTML = '<p>No scripts in this category. Save a query to add it.</p>';
      return;
    }
    
    // Group by category if showing all
    if (this.selectedCategory === 'all') {
      const grouped = {};
      scripts.forEach(script => {
        const catId = script.category || 'general';
        if (!grouped[catId]) {
          grouped[catId] = [];
        }
        grouped[catId].push(script);
      });
      
      Object.keys(grouped).forEach(catId => {
        const cat = this.categories.find(c => c.id === catId) || { name: 'Uncategorized' };
        const catHeader = document.createElement('div');
        catHeader.style.cssText = 'font-weight: bold; margin-top: 10px; margin-bottom: 5px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 3px;';
        catHeader.textContent = cat.name;
        container.appendChild(catHeader);
        
        grouped[catId].forEach(script => {
          container.appendChild(this.createScriptItem(script));
        });
      });
    } else {
      scripts.forEach(script => {
        container.appendChild(this.createScriptItem(script));
      });
    }
  },
  
  createScriptItem: function(script) {
    const div = document.createElement('div');
    div.className = 'script-library-item';
    div.style.cssText = 'margin: 5px 0; padding: 5px; border: 1px solid #ddd; border-radius: 3px; background-color: #fafafa;';
    div.innerHTML = `
      <strong>${script.name}</strong>
      <button class="btn btn-xs btn-primary load-script-btn" data-script-id="${script.id}" style="margin-left: 5px;">Load</button>
      <button class="btn btn-xs btn-success edit-script-btn" data-script-id="${script.id}" style="margin-left: 5px;">Edit</button>
      <button class="btn btn-xs btn-danger delete-script-btn" data-script-id="${script.id}" style="margin-left: 5px;">Delete</button>
      ${script.description ? `<div style="font-size: 0.8em; color: #666; margin-top: 3px;">${script.description}</div>` : ''}
      <div style="font-size: 0.7em; color: #999; margin-top: 2px; font-family: monospace;">${script.query.substring(0, 60)}${script.query.length > 60 ? '...' : ''}</div>
    `;
    
    div.querySelector('.load-script-btn').addEventListener('click', () => {
      this.loadFromScriptLibrary(script.id);
    });
    
    div.querySelector('.edit-script-btn').addEventListener('click', () => {
      this.editScript(script.id);
    });
    
    div.querySelector('.delete-script-btn').addEventListener('click', () => {
      if (confirm('Delete this script from library?')) {
        this.deleteFromScriptLibrary(script.id);
        this.renderScriptLibrary();
      }
    });
    
    return div;
  },
  
  editScript: function(scriptId) {
    const script = this.scriptLibrary.find(s => s.id === scriptId);
    if (!script) {
      alert('Script not found');
      return;
    }
    
    // Create or show script editor modal
    this.showScriptEditor(script);
  },
  
  showScriptEditor: function(script) {
    console.log('showScriptEditor called for script:', script);
    
    // Remove existing modal if any
    const existingModal = document.getElementById('script-editor-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Create modal - use inline styles only, no Bootstrap classes
    const modal = document.createElement('div');
    modal.id = 'script-editor-modal';
    // Set styles directly on element
    modal.setAttribute('style', 'display: block !important; position: fixed !important; z-index: 10000 !important; left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; overflow: auto !important; background-color: rgba(0,0,0,0.5) !important; visibility: visible !important; opacity: 1 !important;');
    
    modal.innerHTML = `
      <div style="width: 90%; max-width: 1200px; margin: 30px auto; position: relative; top: 5%; z-index: 10001;">
        <div style="background-color: #fefefe; padding: 20px; border: 1px solid #888; border-radius: 5px; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
          <div style="margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
            <h4 style="margin: 0; display: inline-block;">Edit Script: ${this.escapeHtml(script.name)}</h4>
            <button type="button" onclick="window.TabManager.closeScriptEditor()" style="float: right; font-size: 28px; font-weight: bold; color: #aaa; cursor: pointer; background: none; border: none; padding: 0; margin: 0; line-height: 1;">&times;</button>
            <div style="clear: both;"></div>
          </div>
          <div style="padding: 10px 0;">
            <div style="margin-bottom: 10px;">
              <label>Name:</label>
              <input type="text" id="script-editor-name" class="form-control" value="${this.escapeHtml(script.name)}" style="margin-bottom: 5px;">
            </div>
            <div style="margin-bottom: 10px;">
              <label>Description:</label>
              <input type="text" id="script-editor-description" class="form-control" value="${this.escapeHtml(script.description || '')}" style="margin-bottom: 5px;">
            </div>
            <div style="margin-bottom: 10px;">
              <label>Category:</label>
              <select id="script-editor-category" class="form-control" style="margin-bottom: 5px;"></select>
            </div>
            <div id="script-editor-text-container">
              <textarea id="script-editor-query" class="form-control" rows="8" style="font-family: monospace;">${this.escapeHtml(script.query)}</textarea>
            </div>
          </div>
          <div style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px; text-align: right;">
            <button type="button" class="btn btn-primary" onclick="window.TabManager.saveScriptFromEditor('${script.id}')" style="margin-right: 5px;">Save</button>
            <button type="button" class="btn btn-default" onclick="window.TabManager.closeScriptEditor()">Cancel</button>
          </div>
        </div>
      </div>
    `;
    
    // Append to body, but check if there's a better container
    let container = document.body;
    
    // Try to find a container that's not hidden
    const possibleContainers = [
      document.body,
      document.documentElement,
      document.querySelector('body'),
      document.querySelector('html')
    ];
    
    for (let c of possibleContainers) {
      if (c && c.offsetParent !== null) {
        container = c;
        break;
      }
    }
    
    container.appendChild(modal);
    console.log('Modal appended to:', container);
    console.log('Modal element:', modal);
    console.log('Modal in DOM:', document.body.contains(modal));
    console.log('Container offsetParent:', container.offsetParent);
    
    // Force modal to be visible immediately using multiple methods
    modal.style.setProperty('display', 'block', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    modal.style.setProperty('opacity', '1', 'important');
    modal.style.setProperty('z-index', '10000', 'important');
    modal.style.setProperty('position', 'fixed', 'important');
    modal.style.setProperty('left', '0', 'important');
    modal.style.setProperty('top', '0', 'important');
    modal.style.setProperty('width', '100%', 'important');
    modal.style.setProperty('height', '100%', 'important');
    
    // Also set directly on style object
    modal.style.display = 'block';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.zIndex = '10000';
    
    // Check visibility after a moment
    setTimeout(() => {
      const computed = window.getComputedStyle(modal);
      console.log('Modal computed styles after append:');
      console.log('  display:', computed.display);
      console.log('  visibility:', computed.visibility);
      console.log('  opacity:', computed.opacity);
      console.log('  z-index:', computed.zIndex);
      console.log('  position:', computed.position);
      console.log('  width:', computed.width);
      console.log('  height:', computed.height);
      console.log('  offsetParent:', modal.offsetParent);
      console.log('  offsetWidth:', modal.offsetWidth);
      console.log('  offsetHeight:', modal.offsetHeight);
      console.log('  getBoundingClientRect:', modal.getBoundingClientRect());
      
      // Try to make it visible again if still hidden
      if (computed.display === 'none' || computed.visibility === 'hidden' || modal.offsetWidth === 0 || modal.offsetHeight === 0) {
        console.warn('Modal still hidden, forcing visibility again');
        // Remove all classes that might hide it
        modal.className = '';
        // Force all styles
        modal.style.cssText = 'display: block !important; position: fixed !important; z-index: 10000 !important; left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; overflow: auto !important; background-color: rgba(0,0,0,0.5) !important; visibility: visible !important; opacity: 1 !important;';
        
        // Also try appending again
        if (!document.body.contains(modal)) {
          document.body.appendChild(modal);
        }
      } else {
        console.log('Modal appears to be visible');
      }
    }, 100);
    
    // Add click handler to close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeScriptEditor();
      }
    });
    
    // Populate category selector
    setTimeout(() => {
      const categorySelect = document.getElementById('script-editor-category');
      if (categorySelect) {
        this.categories.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = cat.name;
          if (cat.id === script.category) {
            option.selected = true;
          }
          categorySelect.appendChild(option);
        });
      }
      
      this.currentEditingScript = script;
    }, 50);
  },
  
  saveScriptFromEditor: function(scriptId) {
    const script = this.scriptLibrary.find(s => s.id === scriptId);
    if (!script) {
      alert('Script not found');
      return;
    }
    
    const name = document.getElementById('script-editor-name').value.trim();
    const description = document.getElementById('script-editor-description').value.trim();
    const category = document.getElementById('script-editor-category').value;
    
    // Get query from text editor
    const query = document.getElementById('script-editor-query').value.trim();
    
    if (!name) {
      alert('Please enter a script name');
      return;
    }
    
    if (!query) {
      alert('Please enter a query');
      return;
    }
    
    // Update script
    script.name = name;
    script.description = description;
    script.category = category;
    script.query = query;
    script.updatedAt = new Date().toISOString();
    
    this.saveScriptLibrary();
    this.renderScriptLibrary();
    this.closeScriptEditor();
    
    alert('Script saved successfully!');
  },
  
  closeScriptEditor: function() {
    const modal = document.getElementById('script-editor-modal');
    if (modal) {
      modal.remove();
    }
    
    this.currentEditingScript = null;
  },
  
  escapeHtml: function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  
  saveScriptLibrary: function() {
    const data = {
      scripts: this.scriptLibrary,
      categories: this.categories
    };
    localStorage.setItem('tinkertiny_script_library', JSON.stringify(data));
  },
  
  // Assign query results to a tab
  assignResultsToTab: function(tabId, results) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.queryResults = results;
      tab.highlightNodes = results.nodes || [];
      tab.highlightEdges = results.edges || [];
      this.saveTabs();
      
      // If this is the active tab, update visualization
      if (tabId === this.activeTabId && typeof updateQueryHighlights === 'function') {
        updateQueryHighlights(tab.highlightNodes, tab.highlightEdges);
      }
    }
  }
};

