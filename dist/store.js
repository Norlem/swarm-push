"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSubscription = addSubscription;
exports.removeSubscription = removeSubscription;
exports.allSubscriptions = allSubscriptions;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
function load() {
    try {
        const raw = fs_1.default.readFileSync(config_1.config.subscriptionsFile, 'utf8');
        const arr = JSON.parse(raw);
        return new Map(arr.map((s) => [s.endpoint, s]));
    }
    catch {
        return new Map();
    }
}
function save(map) {
    const dir = path_1.default.dirname(config_1.config.subscriptionsFile);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(config_1.config.subscriptionsFile, JSON.stringify([...map.values()], null, 2));
}
let _store = load();
function addSubscription(sub) {
    _store.set(sub.endpoint, { ...sub, addedAt: new Date().toISOString() });
    save(_store);
}
function removeSubscription(endpoint) {
    _store.delete(endpoint);
    save(_store);
}
function allSubscriptions() {
    return [..._store.values()];
}
