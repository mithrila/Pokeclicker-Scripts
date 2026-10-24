// ==UserScript==
// @name          [Pokeclicker] Enhanced Auto Mine
// @namespace     Pokeclicker Scripts
// @author        Ephenia (Credit: falcon71, KarmaAlex, umbralOptimatum, Pastaficionado)
// @description   Automatically mines the Underground with Bombs and the Chisel. Discharges a full battery and can sell diamond and gem treasures.
// @copyright     https://github.com/Ephenia
// @license       GPL-3.0 License
// @version       3.0.0

// @homepageURL   https://github.com/Ephenia/Pokeclicker-Scripts/
// @supportURL    https://github.com/Ephenia/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/Ephenia/Pokeclicker-Scripts/master/enhancedautomine.user.js
// @updateURL     https://raw.githubusercontent.com/Ephenia/Pokeclicker-Scripts/master/enhancedautomine.user.js

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==

var mineState;
var autoMineTimer;
var layersMined;
var sellTreasureState;

function initAutoMine() {
    const minerHTML = document.createElement("div");
    minerHTML.id = 'auto-miner';
    minerHTML.innerHTML = `<button id="auto-mine-start" class="col-12 col-md-3 btn btn-${mineState ? 'success' : 'danger'}">Auto Mine [${mineState ? 'ON' : 'OFF'}]</button>
<button id="auto-sell-treasure" class="col-12 col-md-3 btn btn-${sellTreasureState ? 'success' : 'danger'}">Auto Sell [${sellTreasureState ? 'ON' : 'OFF'}]</button>`;
    const mineBody = document.querySelector('#mineModal .modal-body');
    if (!mineBody) {
        return;
    }
    mineBody.prepend(minerHTML);

    document.getElementById('auto-mine-start').addEventListener('click', event => { startAutoMine(event); });
    document.getElementById('auto-sell-treasure').addEventListener('click', event => { autoSellTreasure(event); });

    addGlobalStyle('#auto-miner { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:8px; }');

    if (mineState) {
        // Wait a few seconds to not mine before underground is fully loaded
        setTimeout(() => {
            layersMined = App.game.statistics.undergroundLayersMined();
            autoMineTimer = setInterval(function () {
                doAutoMine();
            }, 1000);
        }, 5000);
    }
}

function startAutoMine(event) {
    const element = event.target;
    mineState = !mineState
    mineState ? element.classList.replace('btn-danger', 'btn-success') : element.classList.replace('btn-success', 'btn-danger');
    element.textContent = `Auto Mine [${mineState ? 'ON' : 'OFF'}]`;
    if (mineState) {
        layersMined = App.game.statistics.undergroundLayersMined();
        autoMineTimer = setInterval(function () {
            doAutoMine();
        }, 1000); // One tool use per second
    } else {
        clearInterval(autoMineTimer)
    }
    localStorage.setItem('autoMineState', mineState);
}

function doAutoMine() {
    const underground = App.game.underground;
    if (!underground?.canAccess()) {
        return;
    }
    sellTreasuresIfLayerCleared();

    const mine = underground.mine;
    if (!mine || mine.completed) {
        underground.generateMine(underground.autoSearchMineType);
        return;
    }
    if (mine.timeUntilDiscovery > 0) {
        return;
    }

    if (underground.battery.canDischarge()) {
        underground.battery.discharge();
    }

    const tools = underground.tools;
    if (Mine.hiddenItemsIDSet(mine).size > 0) {
        const bomb = tools.getTool(UndergroundToolType.Bomb);
        if (bomb?.canUseTool()) {
            tools.useTool(UndergroundToolType.Bomb, 0, 0);
        }
    } else {
        const chisel = tools.getTool(UndergroundToolType.Chisel);
        const tile = findChiselTile(mine);
        if (tile && chisel?.canUseTool()) {
            tools.useTool(UndergroundToolType.Chisel, tile.x, tile.y);
        }
    }

    sellTreasuresIfLayerCleared();
}

function sellTreasuresIfLayerCleared() {
    const layersNow = App.game.statistics.undergroundLayersMined();
    if (sellTreasureState && layersMined != layersNow) {
        sellSellableTreasures();
        layersMined = layersNow;
        localStorage.setItem('undergroundLayersMined', layersMined);
    }
}

function findChiselTile(mine) {
    const partialIds = Mine.partiallyFoundItemsIDSet(mine);
    for (let index = 0; index < mine.grid.length; index++) {
        const tile = mine.grid[index];
        if (tile.reward && tile.layerDepth > 0 && partialIds.has(tile.reward.rewardID)) {
            return mine.getCoordinateForGridIndex(index);
        }
    }
    return null;
}

function sellSellableTreasures() {
    UndergroundItems.list.forEach(item => {
        const owned = player.itemList[item.itemName]();
        if (item.hasSellValue() && owned > 0) {
            UndergroundController.sellMineItem(item, owned);
        }
    });
}

function autoSellTreasure(event) {
    const element = event.target;
    sellTreasureState = !sellTreasureState;
    sellTreasureState ? element.classList.replace('btn-danger', 'btn-success') : element.classList.replace('btn-success', 'btn-danger');
    element.textContent = `Auto Sell [${sellTreasureState ? 'ON' : 'OFF'}]`;
    localStorage.setItem('autoSellTreasure', sellTreasureState);
}

if (!validParse(localStorage.getItem('autoMineState'))) {
    localStorage.setItem("autoMineState", false);
}
if (!validParse(localStorage.getItem('autoSellTreasure'))) {
    localStorage.setItem("autoSellTreasure", false);
}
mineState = JSON.parse(localStorage.getItem('autoMineState'));
sellTreasureState = JSON.parse(localStorage.getItem('autoSellTreasure'));

function validParse(key) {
    try {
        if (key === null) {
            throw new Error;
        }
        JSON.parse(key);
        return true;
    } catch (e) {
        return false;
    }
}

function addGlobalStyle(css) {
    var head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) { return; }
    style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
}

function loadEpheniaScript(scriptName, initFunction, priorityFunction) {
    function reportScriptError(scriptName, error) {
        console.error(`Error while initializing '${scriptName}' userscript:\n${error}`);
        Notifier.notify({
            type: NotificationConstants.NotificationOption.warning,
            title: scriptName,
            message: `The '${scriptName}' userscript crashed while loading. Check for updates or disable the script, then restart the game.\n\nReport script issues to the script developer, not to the Pokéclicker team.`,
            timeout: GameConstants.DAY,
        });
    }
    const windowObject = !App.isUsingClient ? unsafeWindow : window;
    // Inject handlers if they don't exist yet
    if (windowObject.epheniaScriptInitializers === undefined) {
        windowObject.epheniaScriptInitializers = {};
        const oldInit = Preload.hideSplashScreen;
        var hasInitialized = false;

        // Initializes scripts once enough of the game has loaded
        Preload.hideSplashScreen = function (...args) {
            var result = oldInit.apply(this, args);
            if (App.game && !hasInitialized) {
                // Initialize all attached userscripts
                Object.entries(windowObject.epheniaScriptInitializers).forEach(([scriptName, initFunction]) => {
                    try {
                        initFunction();
                    } catch (e) {
                        reportScriptError(scriptName, e);
                    }
                });
                hasInitialized = true;
            }
            return result;
        }
    }

    // Prevent issues with duplicate script names
    if (windowObject.epheniaScriptInitializers[scriptName] !== undefined) {
        console.warn(`Duplicate '${scriptName}' userscripts found!`);
        Notifier.notify({
            type: NotificationConstants.NotificationOption.warning,
            title: scriptName,
            message: `Duplicate '${scriptName}' userscripts detected. This could cause unpredictable behavior and is not recommended.`,
            timeout: GameConstants.DAY,
        });
        let number = 2;
        while (windowObject.epheniaScriptInitializers[`${scriptName} ${number}`] !== undefined) {
            number++;
        }
        scriptName = `${scriptName} ${number}`;
    }
    // Add initializer for this particular script
    windowObject.epheniaScriptInitializers[scriptName] = initFunction;
    // Run any functions that need to execute before the game starts
    if (priorityFunction) {
        $(document).ready(() => {
            try {
                priorityFunction();
            } catch (e) {
                reportScriptError(scriptName, e);
                // Remove main initialization function  
                windowObject.epheniaScriptInitializers[scriptName] = () => null;
            }
        });
    }
}

if (!App.isUsingClient || localStorage.getItem('enhancedautomine') === 'true') {
    loadEpheniaScript('enhancedautomine', initAutoMine);
}
