let debug = true;

const logDebug = (message) => {
    if (debug) {
        console.log(`\x1b[90m[DEBUG]: ${message}\x1b[0m`);
    }
}

const logInfo = (message) => {
    console.log(`\x1b[37m[INFO]: ${message}\x1b[0m`);
}

const logWarning = (message) => {
    console.log(`\x1b[33m[WARN]: ${message}\x1b[0m`);
}

const logError = (message) => {
    console.log(`\x1b[31m[ERR]: ${message}\x1b[0m`);
}

const setDebug = (val) => {
    debug = val;
}

export {logDebug, logInfo, logWarning, logError, setDebug};