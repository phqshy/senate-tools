import fs from "fs";
import convert from "xml2json";
import fetch from "node-fetch";
import * as logger from './logger.js';

const lastTime = 0;

export const saveToCache = async (data, file) => {
    logger.logDebug(`Writing data to ${file}`);
    try {
        await fs.promises.mkdir('./cache');
    } catch (e){}
    await fs.promises.writeFile(`./cache/${file}.json`, JSON.stringify(data, null, 4));
}

export const loadFromCache = async (file) => {
    logger.logDebug(`Loading cache from ${file}`)
    try {
        logger.logDebug(`Cache load successful for ${file}`);
        return JSON.parse(await fs.promises.readFile(`./cache/${file}.json`, {encoding: 'utf8'}));
    } catch (e) {
        logger.logDebug(`Cache load failed for ${file}`);
        return {};
    }
}

export const fetchAPI = async (url) => {
    logger.logInfo(`Fetching ${url}`);

    const ms = Date.now();
    logger.logDebug(`Last request was ${ms - lastTime}ms ago`);
    if ((ms - lastTime) <= 2000) {
        logger.logDebug(`Sleeping for 2000ms (ratelimit)`);
        await sleep(2000);
    }

    const data = await fetch(url, {method: 'GET', headers: { 'User-Agent': 'ImperialSenate-1.0 (the.yeetusa@gmail.com)'}});
    if (data.ok) {
        logger.logDebug(`Status code was OK`);
        return XMLToJSON(await data.text());
    } else {
        logger.logDebug(`Status code returned not OK`);
        return {};
    }
}

const XMLToJSON = async (xml) => {
    logger.logDebug('Parsing XML to JSON');
    return convert.toJson(xml, {object: true});
}

export const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}