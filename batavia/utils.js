
function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

batavia.isArray = Array.isArray;
if (!batavia.isArray) {
    batavia.isArray = function (obj) {
        return  Object.prototype.toString.call(obj) === '[object Array]';
    };
}

/*************************************************************************
 * Type comparison defintions that match Python-like behavior.
 *************************************************************************/

batavia.isinstance = function(obj, type) {
    if (type instanceof Array) {
        for (var t in type) {
            if (batavia.isinstance(obj, type[t])) {
                return true;
            }
        }
        return false;
    } else {
        switch (typeof obj) {
            case 'boolean':
                return type === batavia.types.Bool;
            case 'number':
                return type === batavia.types.Int;
            case 'string':
                return type === batavia.types.Str;
            case 'object':
                return obj instanceof type;
            default:
                return false;
        }
    }
};

batavia.isbataviainstance = function(obj) {
    return batavia.isinstance(obj, [
        batavia.types.Bool, batavia.types.Dict, batavia.types.Float,
        batavia.types.Int, batavia.types.JSDict, batavia.types.List,
        batavia.types.NoneType, batavia.types.Tuple, batavia.types.Slice,
        batavia.types.Bytes, batavia.types.Bytearray, batavia.types.Type,
        batavia.types.Str, batavia.types.Set, batavia.types.Range,
        batavia.types.FrozenSet, batavia.types.Complex,
        batavia.types.NotImplementedType
    ]);
}

batavia.type_name = function(arg) {
    var type_name;

    switch (typeof arg) {
        case 'boolean':
            type_name = 'bool';
            break;
        case 'number':
            type_name = 'Native number';
            break;
        case 'string':
            type_name = 'str';
            break;
        case 'object':
            if (arg === null || arg === batavia.builtins.None) {
                type_name = 'NoneType';
            } else if (arg.__class__ != null && arg.__class__.__name__) {
                type_name = arg.__class__.__name__;
            } else {
                type_name = 'Native object';
            }
    }

    return type_name;
};

batavia.issubclass = function(cls, type) {
    var t;
    if (type instanceof Array) {
        for (t in type) {
            if (batavia.issubclass(cls, type[t])) {
                return true;
            }
        }
        return false;
    } else {
        switch (typeof cls) {
            case 'boolean':
                return type === batavia.types.Bool;
            case 'number':
                return type === batavia.types.Int;
            case 'string':
                return type === batavia.types.Str;
            case 'object':
                if (type === null || type === batavia.types.NoneType) {
                    return cls === null;
                } else {
                    var mro = cls.mro();
                    for (t in mro) {
                        if (type != null && type.prototype != null && mro[t] === type.prototype.__class__) {
                            return true;
                        }
                    }
                }
                return false;
            default:
                return false;
        }
    }
};

/*************************************************************************
 * sprintf() implementation
 *************************************************************************/
batavia._substitute = function(format, args) {
    var results = [];
    var special_case_types = [
        batavia.types.List,
        batavia.types.Dict,
        batavia.types.Bytes];

    /* This is the general form regex for a sprintf-like string. */
    var re = /\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-gijosuxX])/g;
    var match;
    var lastIndex = 0;
    for (var i = 0; i < args.length; i++) {
        var arg = args[i];

        match = re.exec(format);
        if (match) {
            switch (match[8]) {
                case "b":
                    arg = arg.toString(2);
                break;
                case "c":
                    arg = String.fromCharCode(arg);
                break;
                case "d":
                case "i":
                    arg = parseInt(arg, 10);
                break;
                case "j":
                    arg = JSON.stringify(arg, null, match[6] ? parseInt(match[6], 10) : 0);
                break;
                case "e":
                    arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential();
                break;
                case "f":
                    arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg);
                break;
                case "g":
                    arg = match[7] ? parseFloat(arg).toPrecision(match[7]) : parseFloat(arg);
                break;
                case "o":
                    arg = arg.toString(8);
                break;
                case "s":
                    arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg);
                break;
                case "u":
                    arg = arg >>> 0;
                break;
                case "x":
                    arg = arg.toString(16);
                break;
                case "X":
                    arg = arg.toString(16).toUpperCase();
                break;
            }

            results.push(format.slice(lastIndex, match.index));
            lastIndex = re.lastIndex;
            results.push(arg);
        } else if (    (args.constructor === Array)
                    && batavia.isinstance(args[0], special_case_types)) {
            return format;
        } else {
            throw new batavia.builtins.TypeError('not all arguments converted during string formatting');
        }
    }
    // Push the rest of the string.
    results.push(format.slice(re.lastIndex));
    return results.join('');
};

/*************************************************************************
 * Class construction
 *************************************************************************/

batavia.make_class = function(args, kwargs) {
    var func = args[0];
    var name = args[1];
    var bases = kwargs.bases || args[2];
    var metaclass = kwargs.metaclass || args[3];
    var kwds = kwargs.kwds || args[4] || [];

    // Create a locals context, and run the class function in it.
    var locals = new batavia.types.Dict();
    var retval = func.__call__.apply(this, [[], [], locals]);

    // Now construct the class, based on the constructed local context.
    var klass = function(vm, args, kwargs) {
        if (this.__init__) {
            this.__init__.__self__ = this;
            this.__init__.__call__.apply(vm, [args, kwargs]);
        }
    };
    klass.__name__ = name;

    if (bases) {
        // load up the base attributes
        if (batavia.isArray(bases)) {
            throw new batavia.builtins.NotImplementedError("multiple inheritance not supported yet");
        }
        var base = bases.__class__;
        for (var attr in base) {
            if (base.hasOwnProperty(attr)) {
                klass[attr] = base[attr];
                klass.prototype[attr] = base[attr];
            }
        }
    }
    for (var attr in locals) {
        if (locals.hasOwnProperty(attr)) {
            klass[attr] = locals[attr];
            klass.prototype[attr] = locals[attr];
        }
    }
    klass.prototype.__class__ = new batavia.types.Type(name, bases);

    var PyObject = function(vm, klass, name) {
        var __new__ = function(args, kwargs) {
            return new klass(vm, args, kwargs);
        };
        __new__.__python__ = true;
        __new__.__class__ = klass;
        return __new__;
    }(this, klass, name);
    PyObject.__class__ = klass;

    return PyObject;
};

/*************************************************************************
 * callable construction
 *************************************************************************/

batavia.make_callable = function(func) {
    var fn = function(args, kwargs, locals) {
        var retval;
        var callargs = batavia.modules.inspect.getcallargs(func, args, kwargs);

        var frame = this.make_frame({
            'code': func.__code__,
            'callargs': callargs,
            'f_globals': func.__globals__,
            'f_locals': locals || new batavia.types.JSDict()
        });

        if (func.__code__.co_flags & batavia.modules.dis.CO_GENERATOR) {
            gen = new batavia.core.Generator(frame, this);
            frame.generator = gen;
            retval = gen;
        } else {
            retval = this.run_frame(frame);
        }
        return retval;
    };
    fn.__python__ = true;
    return fn;
};

batavia.run_callable = function(self, func, posargs, namedargs) {
    // Here you are in JS-land, and you want to call a method on an object
    // but what kind of callable is it?  You may not know if you were passed
    // the function as an argument.

    // TODO: consider separating these out, which might make things more
    //   efficient, but this at least consolidates the use-cases.

    // This gets the right js-callable thing, and runs it in the VirtualMachine.

    // There are a couple of scenarios:
    // 1. You *are* the virtual machine, and you want to call it:
    //    See batavia.VirtualMachine.prototype.call_function
    //    run_callable(<virtualmachine.is_vm=true>, <python method>, ...)
    //    i.e. run_callable(this, func, posargs, namedargs_dict)
    // 2. You are in a JS-implemented type, and the method or object is
    //    e.g. batavia/types/Map.js,Filter.js
    //    run_callable(<python_parent_obj>, <python_method (with func._vm)>, ...)
    //    If you are just passed an anonymous method:
    //    run_callable(<falsish>, <python_method (with func._vm)>, ...)
    // 3. You are in a builtin called by javascript and you also don't
    //    know the provenance of the object/function
    //    e.g. iter() called internally by types/Map.js
    //    see #2 scenario

    //the VM should pass itself in self, but if it already blessed
    //  a method with itself on ._vm just use that.
    var vm = (func._vm) ? func._vm : self;

    if (self && !self.is_vm && func.__python__ && !func.__self__) {
        // In scenarios 2,3 the VM would normally be doing this
        // at the moment of getting the function through LOAD_ATTR
        // but if we call it by JS, then it still needs to be
        // decorated with itself
        func = new batavia.types.Method(self, func);
        // Note, we change func above, so it can get __self__
        // and be affected by the code-path below
    }

    if ('__python__' in func && '__self__' in func) {
        // A python-style method
        // Methods calls get self as an implicit first parameter.
        if (func.__self__) {
            posargs.unshift(func.__self__);
        }

        // The first parameter must be the correct type.
        if (posargs[0] instanceof func.constructor) {
            throw 'unbound method ' + func.__func__.__name__ + '()' +
                ' must be called with ' + func.__class__.__name__ + ' instance ' +
                'as first argument (got ' + posargs[0].prototype + ' instance instead)';
        }
        func = func.__func__.__call__;
    } else if ('__call__' in func) {
        // A Python callable
        func = func.__call__;
    } else if (func.prototype) {
        // If this is a native Javascript class constructor, wrap it
        // in a method that uses the Python calling convention, but
        // instantiates the object.
        if (!func.__python__ && Object.keys(func.prototype).length > 0) {
            func = function(fn) {
                return function(args, kwargs) {
                    var obj = Object.create(fn.prototype);
                    fn.apply(obj, args);
                    return obj;
                };
            }(func);
        }
    }

    var retval = func.apply(vm, [posargs, namedargs]);
    return retval;
};

// make a proxy object that forwards function calls to the parent class
// TODO: forward all function calls
// TODO: support multiple inheritance
batavia.make_super = function(frame, args) {
    // I guess we have to examine the stack to find out which class we are in?
    // this seems suboptimal...
    // what does CPython do?
    if (args.length != 0) {
        throw new batavia.builtins.NotImplementedError("super does not support arguments yet")
    }
    if (frame.f_code.co_name != '__init__') {
        throw new batavia.builtins.NotImplementedError("super not implemented outside of __init__ yet");
    }
    if (frame.f_code.co_argcount == 0) {
        throw new batavia.builtins.TypeError("no self found in super in __init__");
    }
    var self_name = frame.f_code.co_varnames[0];
    var self = frame.f_locals[self_name];
    var klass = self.__class__;
    if (klass.__bases__.length != 1) {
        throw new batavia.builtins.NotImplementedError("super not implemented for multiple inheritance yet");
    }

    var base = klass.__base__;

    var obj = {
        '__init__': function(args, kwargs) {
            return batavia.run_callable(self, base.__init__, args, kwargs);
        }
    };
    obj.__init__.__python__ = true;
    return obj;
};

/************************
 * Working with iterables
 ************************/

// Iterate a python iterable to completion,
// calling a javascript callback on each item that it yields.
batavia.iter_for_each = function(iterobj, callback) {
    try {
        while (true) {
            var next = batavia.run_callable(iterobj, iterobj.__next__, [], null);
            callback(next);
        }
    } catch (err) {
        if (!(err instanceof batavia.builtins.StopIteration)) {
            throw err;
        }
    }
};

batavia.js2py = function(arg) {
    if (batavia.isArray(arg)) {
        // recurse
        var arr = new batavia.types.List();
        for (var i = 0; i < arg.length; i++) {
            arr.append(batavia.js2py(arg[i]));
        }
        return arr;
    }

    switch (typeof arg) {
        case 'boolean':
            return arg;
        case 'number':
            if (Number.isInteger(arg)) {
                return new batavia.types.Int(arg);
            } else {
              return new batavia.types.Float(arg);
            }
        case 'string':
            return new batavia.types.Str(arg);
        case 'object':
            if (arg === null || arg === batavia.types.NoneType) {
                return null;
            } else if (arg.__class__ != null && arg.__class__.__name__) {
                // already a Python object
                return arg;
            } else {
                // this is a generic object; turn it into a dictionary
                var dict = new batavia.types.Dict();
                for (var k in arg) {
                    if (arg.hasOwnProperty(k)) {
                        dict[batavia.js2py(k)] = batavia.js2py(arg[k])
                    }
                }
                return dict;
            }
        default:
            throw new batavia.builtins.BataviaError("Unknown type " + (typeof arg));
    }
}
