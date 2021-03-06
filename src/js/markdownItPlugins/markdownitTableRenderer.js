// Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin.
// Distributed under an ISC license: https://github.com/markdown-it/markdown-it/

/**
 * @fileoverview Implements markdownitTableRenderer
 * @modifier NHN Ent. FE Development Lab <dl_javascript@nhnent.com>
 */

/*eslint-disable */
function getLine(state, line) {
    var pos = state.bMarks[line] + state.blkIndent,
        max = state.eMarks[line];

    return state.src.substr(pos, max - pos);
}

function escapedSplit(str) {
    var result = [],
        pos = 0,
        max = str.length,
        ch,
        escapes = 0,
        lastPos = 0,
        backTicked = false,
        lastBackTick = 0;

    ch = str.charCodeAt(pos);

    while (pos < max) {
        if (ch === 0x60/* ` */ && (escapes % 2 === 0)) {
            backTicked = !backTicked;
            lastBackTick = pos;
        } else if (ch === 0x7c/* | */ && (escapes % 2 === 0) && !backTicked) {
            result.push(str.substring(lastPos, pos));
            lastPos = pos + 1;
        } else if (ch === 0x5c/* \ */) {
            escapes += 1;
        } else {
            escapes = 0;
        }

        pos += 1;

        // If there was an un-closed backtick, go back to just after
        // the last backtick, but as if it was a normal character
        if (pos === max && backTicked) {
            backTicked = false;
            pos = lastBackTick + 1;
        }

        ch = str.charCodeAt(pos);
    }

    result.push(str.substring(lastPos));

    return result;
}


module.exports = function table(state, startLine, endLine, silent) {
    var ch, lineText, pos, i, nextLine, columns, columnCount, token,
        aligns, alignCount, t, tableLines, tbodyLines;

    // should have at least three lines
    if (startLine + 2 > endLine) {
        return false;
    }

    nextLine = startLine + 1;

    if (state.sCount[nextLine] < state.blkIndent) {
        return false;
    }

    // first character of the second line should be '|' or '-'

    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    if (pos >= state.eMarks[nextLine]) {
        return false;
    }

    ch = state.src.charCodeAt(pos);
    if (ch !== 0x7C/* | */ && ch !== 0x2D/* - */ && ch !== 0x3A/* : */) {
        return false;
    }

    lineText = getLine(state, startLine + 1);
    if (!/^[-:| ]+$/.test(lineText)) {
        return false;
    }

    columns = lineText.split('|');
    aligns = [];
    for (i = 0; i < columns.length; i += 1) {
        t = columns[i].trim();
        if (!t) {
            // allow empty columns before and after table, but not in between columns;
            // e.g. allow ` |---| `, disallow ` ---||--- `
            if (i === 0 || i === columns.length - 1) {
                continue;
            } else {
                return false;
            }
        }

        if (!/^:?-+:?$/.test(t)) {
            return false;
        }
        if (t.charCodeAt(t.length - 1) === 0x3A/* : */) {
            aligns.push(t.charCodeAt(0) === 0x3A/* : */ ? 'center' : 'right');
        } else if (t.charCodeAt(0) === 0x3A/* : */) {
            aligns.push('left');
        } else {
            aligns.push('');
        }
    }
    alignCount = aligns.length;

    lineText = getLine(state, startLine).trim();
    if (lineText.indexOf('|') === -1) {
        return false;
    }
    columns = escapedSplit(lineText.replace(/^\||\|$/g, ''));

    // header row will define an amount of columns in the entire table,
    // and align row shouldn't be smaller than that (the rest of the rows can)
    columnCount = columns.length;
    if (columnCount > alignCount) {
        return false;
    } else if (columnCount < alignCount) {
        for(i = 0; i < alignCount - columnCount; i +=1) {
            columns.push('');
        }
        columnCount = columns.length;
    }

    if (silent) {
        return true;
    }

    token = state.push('table_open', 'table', 1);
    token.map = tableLines = [startLine, 0];

    token = state.push('thead_open', 'thead', 1);
    token.map = [startLine, startLine + 1];

    token = state.push('tr_open', 'tr', 1);
    token.map = [startLine, startLine + 1];

    for (i = 0; i < columnCount; i += 1) {
        token = state.push('th_open', 'th', 1);
        token.map = [startLine, startLine + 1];
        if (aligns[i]) {
            // FIXED: change property style to align
            token.attrs = [['align', aligns[i]]];
        }

        token = state.push('inline', '', 0);
        token.content = columns[i].trim();
        token.map = [startLine, startLine + 1];
        token.children = [];

        token = state.push('th_close', 'th', -1);
    }

    token = state.push('tr_close', 'tr', -1);
    token = state.push('thead_close', 'thead', -1);

    token = state.push('tbody_open', 'tbody', 1);
    token.map = tbodyLines = [startLine + 2, 0];

    for (nextLine = startLine + 2; nextLine < endLine; nextLine += 1) {
        if (state.sCount[nextLine] < state.blkIndent) {
            break;
        }

        lineText = getLine(state, nextLine);
        if (lineText.indexOf('|') === -1) {
            break;
        }

        // keep spaces at beginning of line to indicate an empty first cell, but
        // strip trailing whitespace
        columns = escapedSplit(lineText.replace(/^\||\|\s*$/g, ''));

        token = state.push('tr_open', 'tr', 1);
        for (i = 0; i < columnCount; i += 1) {
            token = state.push('td_open', 'td', 1);
            if (aligns[i]) {
                // FIXED: change property style to align
                token.attrs = [['align', aligns[i]]];
            }

            token = state.push('inline', '', 0);
            token.content = columns[i] ? columns[i].trim() : '';
            token.children = [];

            token = state.push('td_close', 'td', -1);
        }
        token = state.push('tr_close', 'tr', -1);
    }
    token = state.push('tbody_close', 'tbody', -1);
    token = state.push('table_close', 'table', -1);

    tableLines[1] = tbodyLines[1] = nextLine;
    state.line = nextLine;
    return true;
};
