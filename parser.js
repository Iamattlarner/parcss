var ansi = require('ansi-styles');

function parseError(message, token){
    var start = token.index > 50 ? token.index - 50 : 0,
        errorIndex = token.index > 50 ? 50 : token.index,
        surroundingSource = token.sourceRef.source.slice(start, token.index + 50),
        errorMessage = 'Parse error, ' + message + '\n' +
        'At ' + token.index + '\n"' +
        (start === 0 ? '' : '...\n') +
        surroundingSource.slice(0, errorIndex) +
        ansi.red.open +
        surroundingSource.slice(errorIndex, errorIndex+1) +
        ansi.red.close +
        surroundingSource.slice(errorIndex + 1) + '' +
        (surroundingSource.length < 100 ? '' : '...') + '"';

    throw errorMessage;
}

function matchStructure(tokens, structure) {
    for(var i = 0; i < structure.length; i++){
        if(tokens[i].type !== structure[i]){
            parseError('unexpected token.', tokens[i]);
        }
    }
    return true;
}

function findFirstIndex(tokens, type){
    for (var i = 0; i < tokens.length; i++) {
        if(tokens[i].type === type){
            return i;
        }
    }
    return -1;
}

function cleanDelimiters(tokens){
    for (var i = 0; i < tokens.length; i++) {
        if(tokens[i].type === 'delimiter'){
            tokens.splice(i,1);
            i--;
        }
    };

    return tokens;
}

function parseAts(tokens, ast){
    if(tokens[0].type !== 'at'){
        return;
    }

    // eg: @import url("../fonts/Arimo-400-700.woff");
    var position = 1;
    if(tokens[position].type === 'word'){
        while(position < tokens.length && tokens[position-1].type !== 'semicolon' && tokens[position].type !== 'braceOpen'){
            position++;
        }

        if(position>tokens.length || tokens.length - position < 4){
            parseError('unexpected end of input.', tokens[tokens.length-1]);
        }

        matchStructure(
            tokens,
            [
                'at',
                'word',
                'delimiter'
            ]
        );

        var atsTokens = cleanDelimiters(tokens.splice(0, position));

        if(atsTokens[2].type !== 'delimiter'){
            parseError('expected expression', atsTokens[2]);
        }

        ast.push({
            type: 'at',
            childTokens: atsTokens
        });
    }
}

function parseStatement(tokens, ast){
    if(tokens.length === 1 && tokens[0].type === 'delimiter'){
        tokens.splice(position, 1);
        return;
    }

    // eg: any thing at all that isnt a nest or an @;
    var position = 1;
    while(position < tokens.length && tokens[position-1].type !== 'semicolon' && tokens[position].type !== 'braceOpen'){
        position++;
    }

    if(position>tokens.length){
        parseError('unexpected end of input.', tokens[tokens.length-1]);
    }

    var statementTokens = cleanDelimiters(tokens.splice(0, position)).slice(0, -1);

    var statement = {
        type: 'statement',
        property: statementTokens[0].source,
        valueTokens: statementTokens.slice(2)
    };

    ast.push(statement);
}

function parseSelector(tokens) {
    if(tokens[0].type === 'at'){
        return tokens;
    }

    var selectors = [];

    var selector = '';
    while(tokens.length){
        if(tokens[0].type === 'comma'){
            selectors.push(selector.trim());
            selector = '';
        }else{
            if(tokens[0].type !== 'delimiter'){
                selector += tokens[0].source;
            }else{
                selector += ' ';
            }
        }
        tokens.shift();
    }
    selectors.push(selector.trim());
    return selectors;
}

function parseBlock(tokens, ast){
    var firstBraceIndex = findFirstIndex(tokens, 'braceOpen');

    if(firstBraceIndex<0){
        return;
    }

    var position = firstBraceIndex,
        opens = 1;

    while(++position, position <= tokens.length && opens){
        if(!tokens[position]){
            parseError('invalid nesting. No closing token was found', tokens[position-1]);
        }
        if(tokens[position].type === 'braceOpen'){
            opens++;
        }
        if(tokens[position].type === 'braceClose'){
            opens--;
        }
    }

    var block = {
        type: 'block',
        content: parse(tokens.splice(firstBraceIndex+1, position-firstBraceIndex-2))
    }

    var prefixTokens = tokens.splice(0, firstBraceIndex),
        atIndex = findFirstIndex(prefixTokens, 'at');

    if(atIndex >= 0){
        block.kind = prefixTokens[atIndex + 1].source;
    }else{
        block.selectors = parseSelector(prefixTokens);
    }

    tokens.splice(0,2);

    ast.push(block);

    parseBlock(tokens, ast);
}

var parsers = [
    parseBlock,
    parseAts,
    parseStatement
];

function parse(tokens){
    var ast = [];

    tokens = tokens.slice();

    var lastLength = tokens.length;

    while(tokens.length){
        for(var i = 0; i < parsers.length && tokens.length; i++){
            parsers[i](tokens, ast);
        }
        if(lastLength === tokens.length){
            parseError('unknown token', tokens[0]);
            return;
        }
        lastLength = tokens.length;
    }

    return ast;
}

module.exports = parse;