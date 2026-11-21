/**
 * Checks a tool's input against its schema (spec/agent/surface.md,
 * Declarations). It covers what the schemas of the declaration file use:
 * types, `required`, `enum`, `additionalProperties`, array `minItems` and
 * `items`, number `minimum` and `maximum`, and string `pattern`. No schema
 * library is used (constraint C25).
 */

const TYPE_WORDS = {
    string: 'a string',
    number: 'a number',
    integer: 'a whole number',
    boolean: 'true or false',
    object: 'an object',
    array: 'an array',
    null: 'null',
};

function isType( value, type ) {
    switch ( type ) {
        case 'string':
            return typeof value === 'string';
        case 'number':
            return typeof value === 'number' && Number.isFinite( value );
        case 'integer':
            return Number.isInteger( value );
        case 'boolean':
            return typeof value === 'boolean';
        case 'array':
            return Array.isArray( value );
        case 'null':
            return value === null;
        case 'object':
            return (
                typeof value === 'object' &&
                value !== null &&
                ! Array.isArray( value )
            );
    }
    return false;
}

/**
 * @param {*}      value  The value.
 * @param {Object} schema Its schema.
 * @param {string} field  The name the value goes by in a message.
 * @param {string} tool   The tool's name.
 * @return {string|null} What is wrong, naming the field, or null.
 */
function check( value, schema, field, tool ) {
    if ( schema.type ) {
        const types = [].concat( schema.type );
        if ( ! types.some( ( type ) => isType( value, type ) ) ) {
            return `${ field } must be ${ types
                .map( ( type ) => TYPE_WORDS[ type ] )
                .join( ' or ' ) }.`;
        }
    }
    if ( schema.enum && ! schema.enum.includes( value ) ) {
        return `${ field } must be one of ${ schema.enum.join( ', ' ) }.`;
    }
    if (
        schema.pattern &&
        typeof value === 'string' &&
        ! new RegExp( schema.pattern ).test( value )
    ) {
        return `${ field } must match ${ schema.pattern }.`;
    }
    if ( typeof value === 'number' ) {
        if ( schema.minimum !== undefined && value < schema.minimum ) {
            return `${ field } must be ${ schema.minimum } or more.`;
        }
        if ( schema.maximum !== undefined && value > schema.maximum ) {
            return `${ field } must be ${ schema.maximum } or less.`;
        }
    }
    if ( Array.isArray( value ) ) {
        if ( schema.minItems !== undefined && value.length < schema.minItems ) {
            return `${ field } must have at least ${ schema.minItems } ${
                schema.minItems === 1 ? 'item' : 'items'
            }.`;
        }
        if ( schema.items ) {
            for ( let index = 0; index < value.length; index++ ) {
                const wrong = check(
                    value[ index ],
                    schema.items,
                    `${ field }[${ index }]`,
                    tool
                );
                if ( wrong ) {
                    return wrong;
                }
            }
        }
    }
    if ( schema.properties && isType( value, 'object' ) ) {
        for ( const name of schema.required ?? [] ) {
            if ( value[ name ] === undefined ) {
                return `${ name } is required.`;
            }
        }
        for ( const name of Object.keys( value ) ) {
            const property = schema.properties[ name ];
            if ( ! property ) {
                if ( schema.additionalProperties === false ) {
                    return `${ name } is not a field of ${ tool }.`;
                }
                continue;
            }
            const wrong = check( value[ name ], property, name, tool );
            if ( wrong ) {
                return wrong;
            }
        }
    }
    return null;
}

/**
 * @param {*}      input The input a tool was called with.
 * @param {Object} tool  The tool's declaration.
 * @return {string|null} What is wrong with the input, or null.
 */
export function checkInput( input, tool ) {
    return check( input, tool.input, 'The input', tool.name );
}
