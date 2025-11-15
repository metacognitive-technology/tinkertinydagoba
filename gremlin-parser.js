// Gremlin Query Parser for Dagoba
// Supports: v(), e(), out(), in(), both(), outE(), inE(), bothE(), outV(), inV(), bothV(), otherV(), 
// has(), hasLabel(), hasId(), filter(), where(), is(), and(), or(), not(), simplePath(),
// property(), values(), id(), label(), path(), dedup(), 
// order(), by(), take(), limit(), skip(), range(), tail(),
// count(), sum(), min(), max(), mean(), group(), groupCount(),
// as(), back(), log()
// Predicates: eq(), neq(), lt(), lte(), gt(), gte(), inside(), outside(), between(), within(), without()

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
            case 'has':
            case 'hasLabel':
            case 'hasId':
              query = query.add('has', args);
              break;
            case 'values':
              query = query.add('values', args);
              break;
            case 'count':
              query = query.add('count', args);
              break;
            case 'skip':
              query = query.add('skip', args);
              break;
            case 'range':
              query = query.add('range', args);
              break;
            case 'tail':
              query = query.add('tail', args);
              break;
            case 'id':
              query = query.add('id', args);
              break;
            case 'label':
              query = query.add('label', args);
              break;
            case 'inV':
              query = query.add('inV', args);
              break;
            case 'outV':
              query = query.add('outV', args);
              break;
            case 'bothV':
              query = query.add('bothV', args);
              break;
            case 'is':
              query = query.add('is', args);
              break;
            case 'and':
              query = query.add('and', args);
              break;
            case 'or':
              query = query.add('or', args);
              break;
            case 'not':
              query = query.add('not', args);
              break;
            case 'simplePath':
              query = query.add('simplePath', args);
              break;
            case 'group':
              query = query.add('group', args);
              break;
            case 'groupCount':
              query = query.add('groupCount', args);
              break;
            case 'sum':
              query = query.add('sum', args);
              break;
            case 'min':
              query = query.add('min', args);
              break;
            case 'max':
              query = query.add('max', args);
              break;
            case 'mean':
            case 'avg':
              query = query.add('mean', args);
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
    
    // Predicate function calls - e.g., gt(30), lt(100), between(10, 20)
    // Match: predicateName(number or string)
    const predicateMatch = value.match(/^(eq|neq|lt|lte|gt|gte|inside|outside|between|within|without)\s*\(([^)]*)\)$/);
    if (predicateMatch) {
      const predName = predicateMatch[1];
      const predArgs = predicateMatch[2].split(',').map(arg => this.parseArgValue(arg.trim()));
      
      // Check if predicate function exists
      if (window.GremlinPredicates && window.GremlinPredicates[predName]) {
        return window.GremlinPredicates[predName](...predArgs);
      }
    }
    
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

// Predicate functions (section 11) - used with has(), where(), is()
// These create predicate objects that can be evaluated against values
window.GremlinPredicates = {
  // eq(x) - equals
  eq: function(value) {
    return { type: 'eq', value: value };
  },
  
  // neq(x) - not equals
  neq: function(value) {
    return { type: 'neq', value: value };
  },
  
  // lt(x) - less than
  lt: function(value) {
    return { type: 'lt', value: value };
  },
  
  // lte(x) - less than or equal
  lte: function(value) {
    return { type: 'lte', value: value };
  },
  
  // gt(x) - greater than
  gt: function(value) {
    return { type: 'gt', value: value };
  },
  
  // gte(x) - greater than or equal
  gte: function(value) {
    return { type: 'gte', value: value };
  },
  
  // inside(a, b) - value is inside range (a < value < b)
  inside: function(a, b) {
    return { type: 'inside', min: a, max: b };
  },
  
  // outside(a, b) - value is outside range (value < a || value > b)
  outside: function(a, b) {
    return { type: 'outside', min: a, max: b };
  },
  
  // between(a, b) - value is between a and b (a <= value <= b)
  between: function(a, b) {
    return { type: 'between', min: a, max: b };
  },
  
  // within(collection) - value is in collection
  within: function(collection) {
    return { type: 'within', collection: Array.isArray(collection) ? collection : [collection] };
  },
  
  // without(collection) - value is not in collection
  without: function(collection) {
    return { type: 'without', collection: Array.isArray(collection) ? collection : [collection] };
  }
};

// Helper function to evaluate a predicate against a value
window.GremlinPredicates.evaluate = function(predicate, value) {
  if (!predicate || typeof predicate !== 'object') {
    return false;
  }
  
  // Handle predicate objects
  if (predicate.type) {
    // Helper to coerce values for comparison (handle string numbers)
    const coerceForComparison = (val) => {
      if (val === null || val === undefined) return null;
      // Try to convert to number if it's a numeric string
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed !== '' && !isNaN(trimmed) && isFinite(trimmed)) {
          return parseFloat(trimmed);
        }
      }
      // Return as-is if it's already a number or non-numeric
      return val;
    };
    
    switch (predicate.type) {
      case 'eq':
        return value === predicate.value;
      case 'neq':
        return value !== predicate.value;
      case 'lt': {
        const val = coerceForComparison(value);
        const predVal = coerceForComparison(predicate.value);
        if (val === null || predVal === null) return false;
        // For numeric comparisons, ensure both are numbers
        if (typeof val === 'number' && typeof predVal === 'number') {
          return val < predVal;
        }
        // Fallback to string comparison for non-numeric types
        return val < predVal;
      }
      case 'lte': {
        const val = coerceForComparison(value);
        const predVal = coerceForComparison(predicate.value);
        if (val === null || predVal === null) return false;
        if (typeof val === 'number' && typeof predVal === 'number') {
          return val <= predVal;
        }
        return val <= predVal;
      }
      case 'gt': {
        const val = coerceForComparison(value);
        const predVal = coerceForComparison(predicate.value);
        if (val === null || predVal === null) return false;
        // For numeric comparisons, ensure both are numbers
        if (typeof val === 'number' && typeof predVal === 'number') {
          return val > predVal;
        }
        // Fallback to string comparison for non-numeric types
        return val > predVal;
      }
      case 'gte': {
        const val = coerceForComparison(value);
        const predVal = coerceForComparison(predicate.value);
        if (val === null || predVal === null) return false;
        if (typeof val === 'number' && typeof predVal === 'number') {
          return val >= predVal;
        }
        return val >= predVal;
      }
      case 'inside': {
        const val = coerceForComparison(value);
        const min = coerceForComparison(predicate.min);
        const max = coerceForComparison(predicate.max);
        if (val === null || min === null || max === null) return false;
        // For numeric comparisons, ensure all are numbers
        if (typeof val === 'number' && typeof min === 'number' && typeof max === 'number') {
          return val > min && val < max;
        }
        // Fallback for non-numeric types
        return val > min && val < max;
      }
      case 'outside': {
        const val = coerceForComparison(value);
        const min = coerceForComparison(predicate.min);
        const max = coerceForComparison(predicate.max);
        if (val === null || min === null || max === null) return false;
        if (typeof val === 'number' && typeof min === 'number' && typeof max === 'number') {
          return val < min || val > max;
        }
        return val < min || val > max;
      }
      case 'between': {
        const val = coerceForComparison(value);
        const min = coerceForComparison(predicate.min);
        const max = coerceForComparison(predicate.max);
        if (val === null || min === null || max === null) return false;
        if (typeof val === 'number' && typeof min === 'number' && typeof max === 'number') {
          return val >= min && val <= max;
        }
        return val >= min && val <= max;
      }
      case 'within':
        return predicate.collection && predicate.collection.includes(value);
      case 'without':
        return predicate.collection && !predicate.collection.includes(value);
      default:
        return false;
    }
  }
  
  return false;
};

// Make predicates available as global functions for convenience
window.eq = window.GremlinPredicates.eq;
window.neq = window.GremlinPredicates.neq;
window.lt = window.GremlinPredicates.lt;
window.lte = window.GremlinPredicates.lte;
window.gt = window.GremlinPredicates.gt;
window.gte = window.GremlinPredicates.gte;
window.inside = window.GremlinPredicates.inside;
window.outside = window.GremlinPredicates.outside;
window.between = window.GremlinPredicates.between;
window.within = window.GremlinPredicates.within;
window.without = window.GremlinPredicates.without;

// Extend Dagoba with additional pipetypes (only if Dagoba is loaded)
if (typeof Dagoba !== 'undefined') {
  // Helper function to get the item (vertex or edge) from a gremlin
  Dagoba.getItem = function(gremlin) {
    if (gremlin.edge) return gremlin.edge;
    if (gremlin.result && (gremlin.result._out !== undefined || gremlin.result._in !== undefined)) return gremlin.result;
    if (gremlin.vertex) return gremlin.vertex;
    return gremlin.result || gremlin;
  };
  
  // Helper function to get item ID for deduplication
  Dagoba.getItemId = function(gremlin) {
    if (gremlin.edge) {
      return `edge_${gremlin.edge._out._id}_${gremlin.edge._in._id}_${gremlin.edge._label}`;
    }
    if (gremlin.result && gremlin.result._out !== undefined) {
      return `edge_${gremlin.result._out}_${gremlin.result._in}_${gremlin.result._label || 'edge'}`;
    }
    if (gremlin.vertex) {
      return `vertex_${gremlin.vertex._id}`;
    }
    return `unknown_${JSON.stringify(gremlin)}`;
  };
  
  Dagoba.addPipetype('where', function(graph, args, gremlin, state) {
    if (!gremlin) return 'pull';
    
    const item = Dagoba.getItem(gremlin);
    const condition = args[0];
    
    if (typeof condition === 'function') {
      // For functions, pass both the item and the gremlin
      if (!condition(item, gremlin)) return 'pull';
    } else if (typeof condition === 'object' && condition !== null) {
      // Check if it's a predicate object
      if (condition.type && window.GremlinPredicates && window.GremlinPredicates.evaluate) {
        // This is a predicate - but where() typically works with traversal results
        // For now, we'll evaluate against the item itself or a specific property
        // This is a simplified implementation
        const value = gremlin.result !== undefined ? gremlin.result : item;
        if (!window.GremlinPredicates.evaluate(condition, value)) return 'pull';
      } else {
        // Regular object filter
        if (!Dagoba.objectFilter(item, condition)) return 'pull';
      }
    }
    
    return gremlin;
  });

Dagoba.addPipetype('path', function(graph, args, gremlin, state) {
  if (!gremlin) return 'pull';
  
  if (!gremlin.state.path) {
    gremlin.state.path = [];
  }
  
  // Add vertex or edge to path
  const item = Dagoba.getItem(gremlin);
  gremlin.state.path.push(item);
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
  if (!state.items && !gremlin) return 'pull';
  
  if (!state.items) {
    state.items = [];
    state.gremlins = [];
  }
  
  if (gremlin) {
    state.gremlins.push(gremlin);
    return 'pull';
  }
  
  if (state.gremlins.length > 0 && !state.sorted) {
    const property = state.byProperty || 'name';
    state.gremlins.sort((a, b) => {
      const aItem = Dagoba.getItem(a);
      const bItem = Dagoba.getItem(b);
      const aVal = aItem[property];
      const bVal = bItem[property];
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return 0;
    });
    // Store items (vertices or edges) for retrieval
    state.items = state.gremlins.map(g => {
      const item = Dagoba.getItem(g);
      return { item: item, gremlin: g };
    });
    state.sorted = true;
  }
  
  if (!state.items.length) return 'pull';
  
  const { item, gremlin: origGremlin } = state.items.pop();
  
  // Return appropriate gremlin based on item type
  if (origGremlin.edge || (origGremlin.result && origGremlin.result._out !== undefined)) {
    // It's an edge - recreate edge gremlin
    if (origGremlin.edge) {
      return Dagoba.makeGremlin(origGremlin.edge._out, origGremlin.state);
    } else {
      // Edge data in result - need to find the edge in the graph
      const edge = graph.edges.find(e => 
        e._out._id === origGremlin.result._out && 
        e._in._id === origGremlin.result._in &&
        e._label === (origGremlin.result._label || 'edge')
      );
      if (edge) {
        const edgeGremlin = Dagoba.makeGremlin(edge._out, origGremlin.state);
        edgeGremlin.edge = edge;
        edgeGremlin.result = origGremlin.result;
        return edgeGremlin;
      }
    }
  }
  
  // It's a vertex
  return Dagoba.makeGremlin(item, origGremlin.state);
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
    // Get the item to log (vertex, edge, or any other value)
    // Check for edges first, since edge gremlins also have a vertex property
    let itemToLog;
    if (gremlin.edge) {
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
    } else if (gremlin.result && (gremlin.result._out !== undefined || gremlin.result._in !== undefined)) {
      // It's a result object that looks like an edge (has _out or _in)
      itemToLog = {
        type: 'edge',
        ...gremlin.result
      };
    } else if (gremlin.vertex) {
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
    } else if (gremlin.result !== undefined) {
      // It's a result value (property value, number, string, array, etc.)
      // This handles cases like v().values("name").log() or v().count().log()
      const result = gremlin.result;
      
      // Determine the type of the result
      if (result === null || result === undefined) {
        itemToLog = { type: 'null', value: null };
      } else if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') {
        itemToLog = { type: typeof result, value: result };
      } else if (Array.isArray(result)) {
        itemToLog = { type: 'array', value: result, length: result.length };
      } else if (typeof result === 'object') {
        // It's an object - could be a complex result
        itemToLog = { type: 'object', value: result };
      } else {
        itemToLog = { type: typeof result, value: result };
      }
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

  // has() / hasLabel() / hasId() - filtering by property, label, or ID
  Dagoba.addPipetype('has', function(graph, args, gremlin, state) {
    if (!gremlin) return 'pull';
    
    const item = Dagoba.getItem(gremlin);
    
    if (args.length === 0) return gremlin;
    
    // has(key, predicate) - e.g., has('age', gt(30))
    if (args.length === 2 && args[1] && typeof args[1] === 'object' && args[1].type) {
      const propertyValue = item[args[0]];
      // If property doesn't exist, filter out
      if (propertyValue === undefined || propertyValue === null) return 'pull';
      // Evaluate predicate
      const result = window.GremlinPredicates && window.GremlinPredicates.evaluate 
        ? window.GremlinPredicates.evaluate(args[1], propertyValue)
        : false;
      if (!result) return 'pull';
      return gremlin;
    }
    
    // has(key, value) - e.g., has('name', 'John')
    if (args.length === 2) {
      const condition = { [args[0]]: args[1] };
      if (!Dagoba.objectFilter(item, condition)) return 'pull';
      return gremlin;
    }
    
    // has({key: value}) - object form
    if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      const condition = args[0];
      if (!Dagoba.objectFilter(item, condition)) return 'pull';
      return gremlin;
    }
    
    // has('propertyName') - check if property exists (not null/undefined)
    if (args.length === 1 && typeof args[0] === 'string') {
      const propertyName = args[0];
      const propertyValue = item[propertyName];
      // Filter out if property doesn't exist or is null/undefined
      if (propertyValue === undefined || propertyValue === null) return 'pull';
      return gremlin;
    }
    
    // hasLabel('label') - check edge label (when explicitly called as hasLabel or when on edge)
    if (args.length === 1 && typeof args[0] === 'string' && !gremlin.vertex && (gremlin.edge || (gremlin.result && gremlin.result._label))) {
      const label = gremlin.edge ? gremlin.edge._label : gremlin.result._label;
      if (label !== args[0]) return 'pull';
      return gremlin;
    }
    
    // hasId(id) - check ID (when explicitly called as hasId or when arg is a number)
    if (args.length === 1 && typeof args[0] === 'number') {
      const id = gremlin.vertex ? gremlin.vertex._id : (gremlin.edge ? gremlin.edge._id : null);
      if (String(id) !== String(args[0])) return 'pull';
      return gremlin;
    }
    
    // Default: pass through
    return gremlin;
  });

  // values() - extract property values
  Dagoba.addPipetype('values', function(graph, args, gremlin, state) {
    if (!gremlin) return 'pull';
    
    const item = Dagoba.getItem(gremlin);
    if (!args || args.length === 0) {
      // Return all property values
      const values = [];
      Object.keys(item).forEach(key => {
        if (key !== '_id' && key !== '_in' && key !== '_out' && key !== '_label') {
          values.push(item[key]);
        }
      });
      gremlin.result = values;
    } else {
      // Return specific property values
      const values = args.map(key => item[key]).filter(v => v !== undefined);
      gremlin.result = values.length === 1 ? values[0] : values;
    }
    return gremlin;
  });

  // count() - count results
  Dagoba.addPipetype('count', function(graph, args, gremlin, state) {
    if (state.count === undefined) {
      state.count = 0;
      state.hasReturned = false;
      state.started = false; // Track if we've seen at least one gremlin
    }
    
    // If we've already returned the count, we're done
    if (state.hasReturned) {
      return 'done';
    }
    
    if (gremlin) {
      // We have a gremlin - count it and pull for more
      state.started = true; // Mark that we've started processing
      state.count++;
      return 'pull';
    }
    
    // No gremlin - check if we've started processing
    if (!state.started) {
      // Initial call with no gremlin - pull to get the first one
      return 'pull';
    }
    
    // Previous pipe is done and we've processed gremlins - return the count
    if (!state.hasReturned) {
      state.hasReturned = true;
      const resultGremlin = Dagoba.makeGremlin(null, {});
      resultGremlin.result = state.count;
      return resultGremlin;
    }
    
    return 'pull';
  });

  // skip() - skip n items
  Dagoba.addPipetype('skip', function(graph, args, gremlin, state) {
    if (state.skipCount === undefined) {
      state.skipCount = args[0] || 0;
      state.skipped = 0;
    }
    
    if (!gremlin) return 'pull';
    
    if (state.skipped < state.skipCount) {
      state.skipped++;
      return 'pull';
    }
    
    return gremlin;
  });

  // range() - limit to range [start, end)
  Dagoba.addPipetype('range', function(graph, args, gremlin, state) {
    if (state.rangeStart === undefined) {
      state.rangeStart = args[0] || 0;
      state.rangeEnd = args[1] !== undefined ? args[1] : Infinity;
      state.index = 0;
    }
    
    if (!gremlin) return 'pull';
    
    if (state.index < state.rangeStart || state.index >= state.rangeEnd) {
      state.index++;
      return 'pull';
    }
    
    state.index++;
    return gremlin;
  });

  // tail() - get last n items
  Dagoba.addPipetype('tail', function(graph, args, gremlin, state) {
    if (state.tailItems === undefined) {
      state.tailItems = [];
      state.tailCount = args[0] || 1;
      state.hasReturned = false;
      state.started = false;
    }
    
    // If we've already returned, we're done
    if (state.hasReturned) {
      return 'done';
    }
    
    if (gremlin) {
      state.started = true;
      state.tailItems.push(gremlin);
      if (state.tailItems.length > state.tailCount) {
        state.tailItems.shift();
      }
      return 'pull';
    }
    
    // No gremlin - check if we've started processing
    if (!state.started) {
      return 'pull';
    }
    
    // Previous pipe is done, return last items
    if (!state.hasReturned) {
      state.hasReturned = true;
      if (state.tailItems.length === 0) {
        // No items collected, return null result
        const resultGremlin = Dagoba.makeGremlin(null, {});
        resultGremlin.result = null;
        return resultGremlin;
      }
      // Return the last item(s)
      const result = state.tailItems[state.tailCount === 1 ? state.tailItems.length - 1 : 0];
      return result;
    }
    
    return 'pull';
  });

  // id() - get ID
  Dagoba.addPipetype('id', function(graph, args, gremlin, state) {
    if (!gremlin) return 'pull';
    
    const item = Dagoba.getItem(gremlin);
    gremlin.result = item._id;
    return gremlin;
  });

  // label() - get label (for edges)
  Dagoba.addPipetype('label', function(graph, args, gremlin, state) {
    if (!gremlin) return 'pull';
    
    if (gremlin.edge) {
      gremlin.result = gremlin.edge._label;
    } else if (gremlin.result && gremlin.result._label) {
      gremlin.result = gremlin.result._label;
    } else {
      gremlin.result = null;
    }
    return gremlin;
  });

  // inV() - get incoming vertex from edge
  Dagoba.addPipetype('inV', function(graph, args, gremlin, state) {
    if (!gremlin) return 'pull';
    
    if (gremlin.edge) {
      return Dagoba.gotoVertex(gremlin, gremlin.edge._in);
    }
    
    return 'pull';
  });

  // outV() - get outgoing vertex from edge
  Dagoba.addPipetype('outV', function(graph, args, gremlin, state) {
    if (!gremlin) return 'pull';
    
    if (gremlin.edge) {
      return Dagoba.gotoVertex(gremlin, gremlin.edge._out);
    }
    
    return 'pull';
  });

  // bothV() - get both vertices from edge (returns array)
  Dagoba.addPipetype('bothV', function(graph, args, gremlin, state) {
    if (!gremlin) return 'pull';
    
    if (gremlin.edge) {
      gremlin.result = [gremlin.edge._out, gremlin.edge._in];
    } else {
      return 'pull';
    }
    
    return gremlin;
  });

  // is() - simple predicate filter
  Dagoba.addPipetype('is', function(graph, args, gremlin, state) {
    if (!gremlin) return 'pull';
    
    const item = Dagoba.getItem(gremlin);
    const predicate = args[0];
    
    // Get the value to test (result if available, otherwise item)
    const value = gremlin.result !== undefined ? gremlin.result : item;
    
    if (typeof predicate === 'function') {
      if (!predicate(value)) return 'pull';
    } else if (typeof predicate === 'object' && predicate !== null) {
      // Check if it's a predicate object (from eq(), gt(), etc.)
      if (predicate.type && window.GremlinPredicates && window.GremlinPredicates.evaluate) {
        if (!window.GremlinPredicates.evaluate(predicate, value)) return 'pull';
      } else {
        // Regular object filter
        if (!Dagoba.objectFilter(item, predicate)) return 'pull';
      }
    } else {
      // Simple equality check
      if (value !== predicate) return 'pull';
    }
    
    return gremlin;
  });

  // and() - boolean AND
  Dagoba.addPipetype('and', function(graph, args, gremlin, state) {
    if (!gremlin) return 'pull';
    
    // For now, and() requires multiple filter conditions
    // This is a simplified implementation
    const item = Dagoba.getItem(gremlin);
    for (let i = 0; i < args.length; i++) {
      const condition = args[i];
      if (typeof condition === 'object' && !Dagoba.objectFilter(item, condition)) {
        return 'pull';
      }
    }
    
    return gremlin;
  });

  // or() - boolean OR
  Dagoba.addPipetype('or', function(graph, args, gremlin, state) {
    if (!gremlin) return 'pull';
    
    const item = Dagoba.getItem(gremlin);
    for (let i = 0; i < args.length; i++) {
      const condition = args[i];
      if (typeof condition === 'object' && Dagoba.objectFilter(item, condition)) {
        return gremlin;
      }
    }
    
    return 'pull';
  });

  // not() - boolean NOT
  Dagoba.addPipetype('not', function(graph, args, gremlin, state) {
    if (!gremlin) return 'pull';
    
    const item = Dagoba.getItem(gremlin);
    const condition = args[0];
    
    if (typeof condition === 'object' && Dagoba.objectFilter(item, condition)) {
      return 'pull';
    }
    
    return gremlin;
  });

  // simplePath() - ensure no repeated vertices in path
  Dagoba.addPipetype('simplePath', function(graph, args, gremlin, state) {
    if (!gremlin) return 'pull';
    
    if (!gremlin.state.path) {
      gremlin.state.path = [];
    }
    
    const item = Dagoba.getItem(gremlin);
    const itemId = item._id;
    
    // Check if this vertex/edge ID already appears in path
    if (gremlin.state.path.some(p => {
      const pid = p._id || (p._out && p._in ? `${p._out._id}_${p._in._id}` : null);
      return pid === itemId;
    })) {
      return 'pull';
    }
    
    return gremlin;
  });

  // group() - group by key
  Dagoba.addPipetype('group', function(graph, args, gremlin, state) {
    if (state.groupMap === undefined) {
      state.groupMap = {};
      state.hasReturned = false;
      state.started = false;
    }
    
    // If we've already returned, we're done
    if (state.hasReturned) {
      return 'done';
    }
    
    if (gremlin) {
      state.started = true;
      const item = Dagoba.getItem(gremlin);
      const key = args[0] ? (typeof args[0] === 'function' ? args[0](item) : item[args[0]]) : 'default';
      const keyStr = String(key);
      
      if (!state.groupMap[keyStr]) {
        state.groupMap[keyStr] = [];
      }
      state.groupMap[keyStr].push(item);
      return 'pull';
    }
    
    // No gremlin - check if we've started processing
    if (!state.started) {
      return 'pull';
    }
    
    // Previous pipe is done, return grouped result
    if (!state.hasReturned) {
      state.hasReturned = true;
      const resultGremlin = Dagoba.makeGremlin(null, {});
      resultGremlin.result = state.groupMap;
      return resultGremlin;
    }
    
    return 'pull';
  });

  // groupCount() - group and count
  Dagoba.addPipetype('groupCount', function(graph, args, gremlin, state) {
    if (state.groupCount === undefined) {
      state.groupCount = {};
      state.hasReturned = false;
      state.started = false;
    }
    
    // If we've already returned, we're done
    if (state.hasReturned) {
      return 'done';
    }
    
    if (gremlin) {
      state.started = true;
      const item = Dagoba.getItem(gremlin);
      const key = args[0] ? (typeof args[0] === 'function' ? args[0](item) : item[args[0]]) : 'default';
      const keyStr = String(key);
      
      state.groupCount[keyStr] = (state.groupCount[keyStr] || 0) + 1;
      return 'pull';
    }
    
    // No gremlin - check if we've started processing
    if (!state.started) {
      return 'pull';
    }
    
    // Previous pipe is done, return count map
    if (!state.hasReturned) {
      state.hasReturned = true;
      const resultGremlin = Dagoba.makeGremlin(null, {});
      resultGremlin.result = state.groupCount;
      return resultGremlin;
    }
    
    return 'pull';
  });

  // sum() - sum numeric values
  Dagoba.addPipetype('sum', function(graph, args, gremlin, state) {
    if (state.sum === undefined) {
      state.sum = 0;
      state.hasReturned = false;
      state.started = false;
    }
    
    // If we've already returned, we're done
    if (state.hasReturned) {
      return 'done';
    }
    
    if (gremlin) {
      state.started = true;
      const item = Dagoba.getItem(gremlin);
      const value = args[0] ? (typeof args[0] === 'function' ? args[0](item) : item[args[0]]) : (gremlin.result !== undefined ? gremlin.result : item);
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (!isNaN(num)) {
        state.sum += num;
      }
      return 'pull';
    }
    
    // No gremlin - check if we've started processing
    if (!state.started) {
      return 'pull';
    }
    
    // Previous pipe is done, return sum
    if (!state.hasReturned) {
      state.hasReturned = true;
      const resultGremlin = Dagoba.makeGremlin(null, {});
      resultGremlin.result = state.sum;
      return resultGremlin;
    }
    
    return 'pull';
  });

  // min() - minimum value
  Dagoba.addPipetype('min', function(graph, args, gremlin, state) {
    if (state.min === undefined) {
      state.min = null;
      state.hasReturned = false;
      state.started = false;
    }
    
    // If we've already returned, we're done
    if (state.hasReturned) {
      return 'done';
    }
    
    if (gremlin) {
      state.started = true;
      const item = Dagoba.getItem(gremlin);
      const value = args[0] ? (typeof args[0] === 'function' ? args[0](item) : item[args[0]]) : (gremlin.result !== undefined ? gremlin.result : item);
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (!isNaN(num) && (state.min === null || num < state.min)) {
        state.min = num;
      }
      return 'pull';
    }
    
    // No gremlin - check if we've started processing
    if (!state.started) {
      return 'pull';
    }
    
    // Previous pipe is done, return min
    if (!state.hasReturned) {
      state.hasReturned = true;
      const resultGremlin = Dagoba.makeGremlin(null, {});
      resultGremlin.result = state.min;
      return resultGremlin;
    }
    
    return 'pull';
  });

  // max() - maximum value
  Dagoba.addPipetype('max', function(graph, args, gremlin, state) {
    if (state.max === undefined) {
      state.max = null;
      state.hasReturned = false;
      state.started = false;
    }
    
    // If we've already returned, we're done
    if (state.hasReturned) {
      return 'done';
    }
    
    if (gremlin) {
      state.started = true;
      const item = Dagoba.getItem(gremlin);
      const value = args[0] ? (typeof args[0] === 'function' ? args[0](item) : item[args[0]]) : (gremlin.result !== undefined ? gremlin.result : item);
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (!isNaN(num) && (state.max === null || num > state.max)) {
        state.max = num;
      }
      return 'pull';
    }
    
    // No gremlin - check if we've started processing
    if (!state.started) {
      return 'pull';
    }
    
    // Previous pipe is done, return max
    if (!state.hasReturned) {
      state.hasReturned = true;
      const resultGremlin = Dagoba.makeGremlin(null, {});
      resultGremlin.result = state.max;
      return resultGremlin;
    }
    
    return 'pull';
  });

  // mean() / avg() - average value
  Dagoba.addPipetype('mean', function(graph, args, gremlin, state) {
    if (state.meanSum === undefined) {
      state.meanSum = 0;
      state.meanCount = 0;
      state.hasReturned = false;
      state.started = false;
    }
    
    // If we've already returned, we're done
    if (state.hasReturned) {
      return 'done';
    }
    
    if (gremlin) {
      state.started = true;
      const item = Dagoba.getItem(gremlin);
      const value = args[0] ? (typeof args[0] === 'function' ? args[0](item) : item[args[0]]) : (gremlin.result !== undefined ? gremlin.result : item);
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (!isNaN(num)) {
        state.meanSum += num;
        state.meanCount++;
      }
      return 'pull';
    }
    
    // No gremlin - check if we've started processing
    if (!state.started) {
      return 'pull';
    }
    
    // Previous pipe is done, return mean
    if (!state.hasReturned) {
      state.hasReturned = true;
      const resultGremlin = Dagoba.makeGremlin(null, {});
      resultGremlin.result = state.meanCount > 0 ? state.meanSum / state.meanCount : 0;
      return resultGremlin;
    }
    
    return 'pull';
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

