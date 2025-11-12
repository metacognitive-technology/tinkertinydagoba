// Gremlin Query Parser for Dagoba
// Supports: v(), out(), in(), both(), property(), filter(), where(), dedup(), path(), bothE(), otherV(), order(), by(), take()

// Ensure Dagoba is loaded before extending it
if (typeof Dagoba === 'undefined') {
  console.error('Dagoba is not loaded. Make sure dagoba.js is loaded before gremlin-parser.js');
}

window.GremlinParser = {
  parse: function(queryString) {
    if (!queryString || !queryString.trim()) {
      throw new Error('Empty query');
    }
    
    // Remove comments
    queryString = queryString.replace(/\/\/.*$/gm, '');
    
    // Smart split by dots - only split on dots that are NOT inside:
    // - Strings (single or double quoted)
    // - Function bodies (braces)
    // - Parentheses
    const steps = [];
    let current = '';
    let parenDepth = 0;
    let braceDepth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < queryString.length; i++) {
      const char = queryString[i];
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        current += char;
      } else if (inString && char === stringChar) {
        inString = false;
        current += char;
      } else if (!inString) {
        if (char === '(') {
          parenDepth++;
          current += char;
        } else if (char === ')') {
          parenDepth--;
          current += char;
        } else if (char === '{') {
          braceDepth++;
          current += char;
        } else if (char === '}') {
          braceDepth--;
          current += char;
        } else if (char === '.' && parenDepth === 0 && braceDepth === 0) {
          // Only split on dots when we're at the top level
          if (current.trim()) {
            steps.push(current.trim());
          }
          current = '';
        } else {
          current += char;
        }
      } else {
        current += char;
      }
    }
    
    // Add the last step
    if (current.trim()) {
      steps.push(current.trim());
    }
    
    if (steps.length === 0) {
      throw new Error('Invalid query format');
    }
    
    return steps;
  },
  
  execute: function(dagobaGraph, queryString) {
    try {
      const steps = this.parse(queryString);
      let query = null;
      
      steps.forEach((step, index) => {
        // Improved regex to handle function arguments with nested braces/parentheses
        // Match method name and arguments, handling nested structures
        let method, argsStr = '';
        const methodMatch = step.match(/^(\w+)\s*\(/);
        if (methodMatch) {
          method = methodMatch[1];
          // Extract arguments by finding matching parentheses
          let parenDepth = 0;
          let braceDepth = 0;
          let inString = false;
          let stringChar = '';
          let startIdx = method.length + 1; // After "method("
          
          for (let i = startIdx; i < step.length; i++) {
            const char = step[i];
            
            if (!inString && (char === '"' || char === "'")) {
              inString = true;
              stringChar = char;
            } else if (inString && char === stringChar) {
              inString = false;
            } else if (!inString) {
              if (char === '(') parenDepth++;
              else if (char === ')') {
                if (parenDepth === 0 && braceDepth === 0) {
                  argsStr = step.substring(startIdx, i);
                  break;
                }
                parenDepth--;
              } else if (char === '{') braceDepth++;
              else if (char === '}') braceDepth--;
            }
          }
        } else {
          // No parentheses - method only
          const simpleMatch = step.match(/^(\w+)$/);
          if (!simpleMatch) {
            throw new Error(`Invalid step: ${step}`);
          }
          method = simpleMatch[1];
          argsStr = '';
        }
        
        const args = this.parseArgs(argsStr);
        
        console.log(`Step ${index}: method=${method}, argsStr="${argsStr}", args=`, args);
        
        if (index === 0) {
          // First step must be v() or e() or similar
          if (method === 'v' || method === 'V') {
            console.log('Calling dagobaGraph.v with args:', args);
            query = dagobaGraph.v(...args);
            console.log('Query created:', query);
          } else if (method === 'e' || method === 'E') {
            // Support for edge queries - return edges directly
            console.log('Edge query - returning edges');
            // Create a special query that returns edges
            query = dagobaGraph.v(); // Start with empty vertex query
            query.add('edges', args); // Add custom edges pipetype
            console.log('Edge query created:', query);
          } else {
            throw new Error(`Query must start with v() or e(): ${step}`);
          }
        } else {
          // Subsequent steps
          if (!query) {
            throw new Error('Query not initialized');
          }
          
          // Map Gremlin methods to Dagoba methods
          switch(method) {
            case 'out':
            case 'outE':
              query = query.out(...args);
              break;
            case 'in':
            case 'inE':
              query = query.in(...args);
              break;
            case 'both':
            case 'bothE':
              query = query.both(...args);
              break;
            case 'otherV':
              query = query.add('otherV', args);
              break;
            case 'property':
              query = query.property(...args);
              break;
            case 'filter':
              query = query.filter(...args);
              break;
            case 'where':
              query = query.add('where', args);
              break;
            case 'dedup':
            case 'deduplicate':
              query = query.unique();
              break;
            case 'path':
              query = query.add('path', args);
              break;
            case 'order':
              query = query.add('order', args);
              break;
            case 'by':
              query = query.add('by', args);
              break;
            case 'take':
            case 'limit':
              query = query.take(...args);
              break;
            case 'as':
              query = query.as(...args);
              break;
            case 'back':
              query = query.back(...args);
              break;
            case 'log':
              query = query.add('log', args);
              break;
            case 'run':
              // This is handled separately
              break;
            default:
              throw new Error(`Unknown method: ${method}`);
          }
        }
      });
      
      if (!query) {
        throw new Error('Query not properly constructed');
      }
      
      return query.run();
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    }
  },
  
  parseArgs: function(argsStr) {
    if (!argsStr.trim()) {
      return [];
    }
    
    // Enhanced argument parsing - handles strings, numbers, objects, and functions
    const args = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    let braceDepth = 0;
    let parenDepth = 0;
    
    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        current += char;
      } else if (inString && char === stringChar) {
        inString = false;
        current += char;
      } else if (!inString) {
        if (char === '{') {
          braceDepth++;
          current += char;
        } else if (char === '}') {
          braceDepth--;
          current += char;
        } else if (char === '(') {
          parenDepth++;
          current += char;
        } else if (char === ')') {
          parenDepth--;
          current += char;
        } else if (braceDepth === 0 && parenDepth === 0 && char === ',') {
          // Only split on comma if we're not inside braces or parentheses
          args.push(this.parseArgValue(current.trim()));
          current = '';
        } else {
          current += char;
        }
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      args.push(this.parseArgValue(current.trim()));
    }
    
    return args;
  },
  
  parseArgValue: function(value) {
    value = value.trim();
    
    // String
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    // Function - check if it starts with "function" or is an arrow function
    if (value.startsWith('function') || (value.includes('=>') && (value.startsWith('(') || /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=>/.test(value)))) {
      try {
        // Use Function constructor to safely create the function
        // Extract function body and parameters
        if (value.startsWith('function')) {
          // Regular function: function(v) { return v.generation > 20 }
          // Match: function (optional whitespace) (params) (optional whitespace) { body }
          const funcMatch = value.match(/^function\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/);
          if (funcMatch) {
            const params = funcMatch[1].split(',').map(p => p.trim()).filter(p => p);
            const body = funcMatch[2].trim();
            // Ensure body has return statement if it's an expression
            const bodyWithReturn = body.includes('return') ? body : `return ${body}`;
            return new Function(...params, bodyWithReturn);
          }
        } else if (value.includes('=>')) {
          // Arrow function: (v) => v.generation > 20 or v => v.generation > 20
          // Match parameters (with or without parentheses) and body
          const arrowMatch = value.match(/^\(?([^)]*)\)?\s*=>\s*(.+)$/);
          if (arrowMatch) {
            const paramStr = arrowMatch[1].trim();
            const params = paramStr ? paramStr.split(',').map(p => p.trim()).filter(p => p) : [];
            const body = arrowMatch[2].trim();
            // If body doesn't start with return and contains braces, it's a block
            // Otherwise, it's an expression that needs return
            const bodyWithReturn = body.startsWith('{') 
              ? (body.includes('return') ? body : body.replace(/\{/, '{ return ').replace(/\}$/, ' }'))
              : (body.startsWith('return') ? body : `return ${body}`);
            return new Function(...params, bodyWithReturn);
          }
        }
        // Fallback: try eval (in controlled environment)
        return eval(`(${value})`);
      } catch (e) {
        console.warn('Could not parse function:', value, e);
        throw new Error(`Invalid function syntax: ${value}`);
      }
    }
    
    // Number
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^-?\d*\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    
    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // Object (simple JSON-like) - handle both single and double quotes
    if (value.startsWith('{') && value.endsWith('}')) {
      try {
        // First try direct JSON parse
        return JSON.parse(value);
      } catch (e) {
        // If that fails, try converting single quotes to double quotes for JSON
        try {
          // Replace single quotes with double quotes, but be careful with escaped quotes
          let jsonStr = value.replace(/'/g, '"');
          return JSON.parse(jsonStr);
        } catch (e2) {
          // If still fails, try a more sophisticated approach
          try {
            // Use eval as last resort (safe here since it's user input in controlled environment)
            // But first, validate it's an object-like structure
            if (/^\{[^}]*\}$/.test(value)) {
              // Replace single-quoted keys and values with double-quoted
              let fixed = value.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
                                .replace(/:\s*'([^']*)'/g, ': "$1"');
              return JSON.parse(fixed);
            }
          } catch (e3) {
            console.warn('Could not parse object:', value, e3);
            return value;
          }
        }
      }
    }
    
    // Default: return as string (for labels, etc.)
    return value;
  }
};

// Extend Dagoba with additional pipetypes (only if Dagoba is loaded)
if (typeof Dagoba !== 'undefined') {
  Dagoba.addPipetype('where', function(graph, args, gremlin, state) {
  if (!gremlin) return 'pull';
  
  const condition = args[0];
  if (typeof condition === 'function') {
    if (!condition(gremlin.vertex, gremlin)) return 'pull';
  } else if (typeof condition === 'object') {
    if (!Dagoba.objectFilter(gremlin.vertex, condition)) return 'pull';
  }
  
  return gremlin;
});

Dagoba.addPipetype('path', function(graph, args, gremlin, state) {
  if (!gremlin) return 'pull';
  
  if (!gremlin.state.path) {
    gremlin.state.path = [];
  }
  gremlin.state.path.push(gremlin.vertex);
  gremlin.result = gremlin.state.path;
  
  return gremlin;
});

Dagoba.addPipetype('otherV', function(graph, args, gremlin, state) {
  if (!gremlin) return 'pull';
  
  if (gremlin.edge) {
    const otherVertex = gremlin.edge._in === gremlin.vertex 
      ? gremlin.edge._out 
      : gremlin.edge._in;
    return Dagoba.gotoVertex(gremlin, otherVertex);
  }
  
  return 'pull';
});

Dagoba.addPipetype('order', function(graph, args, gremlin, state) {
  if (!state.vertices && !gremlin) return 'pull';
  
  if (!state.vertices) {
    state.vertices = [];
    state.gremlins = [];
  }
  
  if (gremlin) {
    state.gremlins.push(gremlin);
    return 'pull';
  }
  
  if (state.gremlins.length > 0 && !state.sorted) {
    const property = state.byProperty || 'name';
    state.gremlins.sort((a, b) => {
      const aVal = a.vertex[property];
      const bVal = b.vertex[property];
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return 0;
    });
    state.vertices = state.gremlins.map(g => g.vertex);
    state.sorted = true;
  }
  
  if (!state.vertices.length) return 'pull';
  
  const vertex = state.vertices.pop();
  return Dagoba.makeGremlin(vertex, {});
});

Dagoba.addPipetype('by', function(graph, args, gremlin, state) {
  if (args[0]) {
    state.byProperty = args[0];
  }
  return gremlin || 'pull';
});

// Add log pipetype to output items to log pane
Dagoba.addPipetype('log', function(graph, args, gremlin, state) {
  if (!gremlin) return 'pull';
  
  try {
    // Get the item to log (vertex or edge)
    let itemToLog;
    if (gremlin.vertex) {
      // It's a vertex - create a clean representation
      itemToLog = {
        type: 'vertex',
        _id: gremlin.vertex._id,
        properties: {}
      };
      // Copy all properties except internal ones
      Object.keys(gremlin.vertex).forEach(key => {
        if (key !== '_id' && key !== '_in' && key !== '_out') {
          itemToLog.properties[key] = gremlin.vertex[key];
        }
      });
    } else if (gremlin.edge) {
      // It's an edge - create a clean representation
      itemToLog = {
        type: 'edge',
        _out: gremlin.edge._out._id,
        _in: gremlin.edge._in._id,
        _label: gremlin.edge._label,
        properties: {}
      };
      // Copy all edge properties except internal ones
      Object.keys(gremlin.edge).forEach(key => {
        if (key !== '_id' && key !== '_in' && key !== '_out' && key !== '_label') {
          itemToLog.properties[key] = gremlin.edge[key];
        }
      });
    } else if (gremlin.result) {
      // It's a result object
      itemToLog = gremlin.result;
    } else {
      // Fallback - log the gremlin itself
      itemToLog = {
        type: 'unknown',
        data: gremlin
      };
    }
    
    // Format as JSON and add to log pane
    const logPane = document.getElementById('gremlin-log');
    if (logPane) {
      const timestamp = new Date().toLocaleTimeString();
      const jsonStr = JSON.stringify(itemToLog, null, 2);
      const logEntry = document.createElement('div');
      logEntry.style.marginBottom = '10px';
      logEntry.style.padding = '5px';
      logEntry.style.borderBottom = '1px solid #ddd';
      logEntry.innerHTML = `<strong style="color: #666;">[${timestamp}]</strong><pre style="margin: 5px 0; white-space: pre-wrap; word-wrap: break-word;">${jsonStr}</pre>`;
      logPane.appendChild(logEntry);
      // Auto-scroll to bottom
      logPane.scrollTop = logPane.scrollHeight;
    }
  } catch (e) {
    console.warn('Error logging item:', e);
  }
  
  // Pass the gremlin through unchanged
  return gremlin;
});

// Add edges pipetype to return edges directly
Dagoba.addPipetype('edges', function(graph, args, gremlin, state) {
  if (!state.edges) {
    // Initialize: get all edges or filter them
    let allEdges = graph.edges;
    
    if (args.length > 0) {
      if (typeof args[0] === 'object') {
        // Filter edges by properties
        allEdges = allEdges.filter(edge => {
          return Dagoba.objectFilter(edge, args[0]);
        });
      } else if (typeof args[0] === 'string') {
        // Filter by edge label
        allEdges = allEdges.filter(edge => edge._label === args[0]);
      }
    }
    
    state.edges = allEdges;
    state.index = 0;
  }
  
  if (state.index >= state.edges.length) {
    return 'done';
  }
  
  // Return edge as a gremlin with edge property
  const edge = state.edges[state.index++];
  const edgeGremlin = Dagoba.makeGremlin(edge._out, {}); // Use out vertex as base
  edgeGremlin.edge = edge;
  // Store edge in result - format it as an object with _out, _in, _label
  edgeGremlin.result = {
    _out: edge._out,
    _in: edge._in,
    _label: edge._label,
    // Include any other edge properties
    ...Object.keys(edge).reduce((props, key) => {
      if (key !== '_out' && key !== '_in' && key !== '_label') {
        props[key] = edge[key];
      }
      return props;
    }, {})
  };
  return edgeGremlin;
});

} else {
  console.error('Cannot extend Dagoba: Dagoba is not defined. Make sure dagoba.js loads before gremlin-parser.js');
}

