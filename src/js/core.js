// SPDX-License-Identifier: AGPL-3.0-or-later
// QoLBar's file format: parse and save byte-identically, names, colors, hotkeys, conditions, import strings, readable JSON. No browser code: test.mjs loads this file in Node.
"use strict";

const T_CONFIG = "QoLBar.Configuration, QoLBar";
const T_BAR = "QoLBar.BarCfg, QoLBar";
const T_SH = "QoLBar.ShCfg, QoLBar";
const T_SET = "QoLBar.CndSetCfg, QoLBar";
const T_CND = "QoLBar.CndCfg, QoLBar";

// Fields the plugin stores as float; Newtonsoft writes these with a trailing ".0"
const FLOAT_KEYS = new Set(["iZ","iO","iR","cS","cF","p","s","rA","fS","FontSize"]);

const SH_TYPES = ["Command","Category","Spacer"];
const SH_MODES = ["Default","Incremental","Random"];
const DOCK = ["Top","Right","Bottom","Left","Undocked"];
const ALIGN = ["Left / Top","Center","Right / Bottom"];
const ALIGN_KEYS = ["LeftOrTop","Center","RightOrBottom"];
const VISIBILITY = ["Slide","Immediate","Always"];
const OPERATORS = ["AND","OR","EQUALS","XOR"];
const ANIMS = ["None","Slow Rainbow","Rainbow","Fast Rainbow","Slow Fade","Fade","Fast Fade","Red Transition","Yellow Transition","Green Transition","Cyan Transition","Blue Transition","Purple Transition","White Transition","Black Transition"];
const CD_FLAGS = [[1,"Number"],[2,"Disable"],[4,"Cooldown"],[8,"GCD Cooldown"],[16,"Charge Cooldown"]];
const ICON_ARGS = [["f","Frame","Applies the hotbar frame"],["n","No frame","Removes the hotbar frame"],["l","Low-res","Uses the low resolution icon"],["h","High-res","Uses the high resolution icon if it exists"],["g","Grayscale","Changes the icon to grayscale"],["r","Reverse","Mirrors the icon horizontally"]];

const SH_KEYS = ["$type","n","t","c","k","kP","sL","m","cl","clA","iZ","iO","iR","cdA","cdS","cW","cSO","cC","cSp","cS","cF","cNB","cH","cHC","_i"];
const BAR_KEYS = ["$type","n","k","sL","h","d","a","v","ht","bW","e","cT","p","l","co","s","rA","fS","sp","nB","c"];

function shDefaults(){ return {"$type":T_SH,n:"",t:0,c:"",k:0,kP:false,sL:null,m:0,cl:4294967295,clA:0,iZ:1,iO:[0,0],iR:0,cdA:0,cdS:0,cW:140,cSO:false,cC:1,cSp:[8,4],cS:1,cF:1,cNB:false,cH:false,cHC:false,_i:0}; }
function barDefaults(){ return {"$type":T_BAR,n:"",k:0,sL:[],h:false,d:2,a:1,v:2,ht:false,bW:100,e:false,cT:false,p:[0,0],l:false,co:0,s:1,rA:1,fS:1,sp:[8,4],nB:false,c:-1}; }
function setDefaults(){ return {"$type":T_SET,n:"",c:[]}; }
function cndDefaults(){ return {"$type":T_CND,i:"cf",a:0,n:false,o:0}; }

// Rebuild an object in canonical key order, filling missing keys from defaults, keeping unknown keys at the end
function canon(obj, defaults){
  const out = {};
  for (const k of Object.keys(defaults)) out[k] = (obj && k in obj) ? obj[k] : defaults[k];
  if (obj) for (const k of Object.keys(obj)) if (!(k in out)) out[k] = obj[k];
  return out;
}
function makeShortcut(over){ return canon(over, shDefaults()); }
function makeBar(over){ return canon(over, barDefaults()); }
function makeSet(over){ return canon(over, setDefaults()); }
function makeCond(over){ return canon(over, cndDefaults()); }

/* ---------- JSON in / out (byte-compatible with Newtonsoft Formatting.Indented) ---------- */
const isRaw = v => v !== null && typeof v === "object" && !Array.isArray(v) && typeof v.__raw === "string" && Object.keys(v).length === 1;
let _srcCtx = null;
function reviverSupportsSource(){
  if (_srcCtx === null) { try { JSON.parse("1", (k, v, c) => { _srcCtx = !!(c && c.source === "1"); return v; }); } catch { _srcCtx = false; } }
  return _srcCtx;
}
function parseConfig(text){
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  if (reviverSupportsSource()) {
    return JSON.parse(text, (k, v, ctx) => (typeof v === "number" && !Number.isSafeInteger(v) && ctx && /^-?\d+$/.test(ctx.source)) ? {__raw: ctx.source} : v);
  }
  // Fallback: protect integers too large for a JS number (character IDs) before parsing
  return JSON.parse(text.replace(/(:\s*)(-?\d{16,})(?=\s*[,}\r\n])/g, (m, a, d) => Number.isSafeInteger(Number(d)) ? m : `${a}{"__raw":"${d}"}`));
}
function fmtFloat(n){
  let s = String(n);
  if (/e/i.test(s)) { const [m, e] = s.split(/e/i); const sign = e[0] === "-" ? "-" : "+"; let d = e.replace(/^[+-]/, ""); if (d.length < 2) d = "0" + d; return m + "E" + sign + d; }
  if (!s.includes(".")) s += ".0";
  return s;
}
function serialize(v, ind = 0, key = "", NL = "\r\n"){
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") return FLOAT_KEYS.has(key) ? fmtFloat(v) : (Number.isInteger(v) ? String(v) : fmtFloat(v));
  if (isRaw(v)) return v.__raw;
  const pad = "  ".repeat(ind + 1), end = "  ".repeat(ind);
  if (Array.isArray(v)) return v.length ? "[" + NL + v.map(x => pad + serialize(x, ind + 1, key, NL)).join("," + NL) + NL + end + "]" : "[]";
  const ks = Object.keys(v);
  if (!ks.length) return "{}";
  return "{" + NL + ks.map(k => pad + JSON.stringify(k) + ": " + serialize(v[k], ind + 1, k, NL)).join("," + NL) + NL + end + "}";
}
// Single line version with the same number rules (used for in-game export strings)
function compactJson(v, key = ""){
  if (v === null || v === undefined) return "null";
  if (typeof v !== "object") return serialize(v, 0, key);
  if (isRaw(v)) return v.__raw;
  if (Array.isArray(v)) return "[" + v.map(x => compactJson(x, key)).join(",") + "]";
  return "{" + Object.keys(v).map(k => JSON.stringify(k) + ":" + compactJson(v[k], k)).join(",") + "}";
}

/* ---------- names: "Label::fh60081##Tooltip" ---------- */
function parseName(n){
  n = n || "";
  const hi = n.indexOf("##");
  const pre = hi >= 0 ? n.slice(0, hi) : n;
  const out = {label: pre, hasIcon: false, args: "", iconRaw: "", icon: 0, hasTooltip: hi >= 0, tooltip: hi >= 0 ? n.slice(hi + 2) : ""};
  const ci = pre.indexOf("::");
  if (ci >= 0) {
    out.hasIcon = true; out.label = pre.slice(0, ci);
    const rest = pre.slice(ci + 2);
    let i = 0; while (i < rest.length && "fnlhgr".includes(rest[i])) i++;
    out.args = rest.slice(0, i); out.iconRaw = rest.slice(i);
    out.icon = /^\s*[+-]?\d+\s*$/.test(out.iconRaw) ? parseInt(out.iconRaw, 10) : 0;
  }
  return out;
}
function buildName(p){ return (p.label || "") + (p.hasIcon ? "::" + (p.args || "") + (p.iconRaw ?? "") : "") + (p.hasTooltip ? "##" + (p.tooltip || "") : ""); }
function displayName(sh){
  const p = parseName(sh.n);
  return p.label || p.tooltip || (p.hasIcon ? "Icon " + p.iconRaw : "") || "";
}
// Icon IDs from 10,000,000 up are whole game UI sheets (TextureDictionary.AddExtraTextures): 10000000 + n is
// ui/uld/<ULD_SHEETS[n]>. QoLBar pads the sheet to a square, and people pick a symbol out with zoom and offset.
const SHEET_BASE = 10000000;
const ULD_SHEETS = {0:"icona_frame",1:"icona_recast",2:"icona_recast2",100:"achievement",101:"actionbar",102:"actioncross",103:"actionmenu",104:"adventurenotebook",105:"alarm",106:"aozbriefing",107:"aoznotebook",108:"aquariumsetting",109:"areamap",110:"armouryboard",300:"camerasettings",301:"cardtripletriad",302:"character",303:"charactergearset",304:"charamake",305:"charamake_dataimport",306:"charaselect",307:"circlebuttons",308:"circlefinder",309:"colosseumresult",310:"companycraftrecipe",311:"concentration",312:"configbackup",313:"contentsfinder",314:"contentsinfo",315:"contentsnotebook",316:"contentsreplayplayer",317:"contentsreplaysetting",318:"creditplayer",319:"cursor",400:"deepdungeonclassjob",401:"deepdungeonnavimap_ankh",402:"deepdungeonnavimap_key",403:"deepdungeonresult",404:"deepdungeonsavedata",405:"deepdungeontopmenu",406:"description",407:"dtr",500:"emjicon",501:"emjicon2",502:"emjicon3",503:"emjparts",504:"emote",505:"enemylist",506:"eurekaelementaledit",507:"eurekaelementalhud",508:"eurekalogosshardlist",509:"exp_gauge",510:"explorationdetail",511:"explorationship",600:"fashioncheck",601:"fashioncheckscoregauge",602:"fashioncheckscoregaugenum",603:"fate",604:"fishingnotebook",605:"freecompany",700:"gateresult",701:"gatherercraftericon",702:"gcarmy",703:"gcarmychangeclass",704:"gcarmychangemirageprism",705:"gcarmyclass",706:"gcarmyexpedition",707:"gcarmyexpeditionforecast",708:"gcarmyexpeditionresult",709:"gcarmymemberprofile",710:"goldsaucercarddeckedit",800:"housing",801:"housinggoods",802:"housingguestbook",803:"housingguestbook2",804:"howto",900:"iconverminion",901:"image2",902:"inventory",903:"itemdetail",1000:"jobhudacn0",1001:"jobhudast0",1002:"jobhudblm0",1003:"jobhudbrd0",1004:"jobhuddnc0",1005:"jobhuddrg0",1006:"jobhuddrk0",1007:"jobhuddrk1",1008:"jobhudgnb",1009:"jobhudmch0",1010:"jobhudmnk1",1011:"jobhudnin1",1012:"jobhudpld",1013:"jobhudsam1",1014:"jobhudsch0",1015:"jobhudsimple_stacka",1016:"jobhudsimple_stackb",1017:"jobhudsmn0",1018:"jobhudsmn1",1019:"jobhudwar",1020:"jobhudwhm",1021:"journal",1022:"journal_detail",1201:"letterlist2",1202:"letterlist3",1203:"letterviewer",1204:"levelup2",1205:"lfg",1206:"linkshell",1207:"lotterydaily",1208:"lotteryweekly",1209:"lovmheader",1210:"lovmheadernum",1211:"lovmpalette",1300:"maincommand_icon",1301:"minerbotanist",1302:"minionnotebook",1303:"minionnotebookykw",1304:"mirageprismplate2",1400:"navimap",1401:"negotiation",1402:"nikuaccepted",1403:"numericstepperb",1500:"orchestrionplaylist",1600:"partyfinder",1601:"performance",1602:"puzzle",1603:"pvpduelrequest",1604:"pvprankpromotionqualifier",1605:"pvpscreeninformation",1606:"pvpsimulationheader2",1607:"pvpsimulationmachineselect",1608:"pvpteam",1800:"racechocoboranking",1801:"racechocoboresult",1802:"readycheck",1803:"recipenotebook",1804:"relic2growth",1805:"retainer",1806:"rhythmaction",1807:"rhythmactionstatus",1808:"roadstone",1900:"satisfactionsupplyicon",2000:"teleport",2001:"todolist",2002:"togglebutton",2300:"weeklybingo",2301:"worldtransrate"};
// Every path QoLBar would try, in its order: plain, then the language folder (icons with text baked in, like
// ui/icon/152000/en/152241.tex, only exist there), high resolution first when asked for.
function iconUrls(id, hr = true){
  if (id >= SHEET_BASE) return [iconUrl(id, hr), hr ? iconUrl(id, false) : null].filter(Boolean);
  const out = [];
  for (const r of hr ? [true, false] : [false]) out.push(iconUrl(id, r), iconUrl(id, r, "en/"));
  return out.filter(Boolean);
}
function iconUrl(id, hr = true, lang = ""){
  if (!(id > 0)) return null;
  if (id >= SHEET_BASE) {
    const sheet = ULD_SHEETS[id - SHEET_BASE];
    return sheet ? `https://v2.xivapi.com/api/asset?path=ui/uld/${sheet}${hr ? "_hr1" : ""}.tex&format=png` : null;
  }
  const folder = String(Math.floor(id / 1000) * 1000).padStart(6, "0");
  return `https://v2.xivapi.com/api/asset?path=ui/icon/${folder}/${lang}${String(id).padStart(6, "0")}${hr ? "_hr1" : ""}.tex&format=png`;
}

/* ---------- colors: stored as uint 0xAABBGGRR (ImGui packing) ---------- */
function colorToRGBA(u){ u = u >>> 0; return {r: u & 255, g: (u >>> 8) & 255, b: (u >>> 16) & 255, a: (u >>> 24) & 255}; }
function rgbaToColor({r, g, b, a}){ return (((a & 255) << 24) >>> 0) + ((b & 255) << 16) + ((g & 255) << 8) + (r & 255); }
const hx = n => n.toString(16).padStart(2, "0").toUpperCase();
function colorToHex(u){ const c = colorToRGBA(u); return "#" + hx(c.r) + hx(c.g) + hx(c.b) + hx(c.a); }
function hexToColor(s){
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(s).trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return rgbaToColor({r: v >> 16 & 255, g: v >> 8 & 255, b: v & 255, a: m[2] ? parseInt(m[2], 16) : 255});
}
const cssColor = u => { const c = colorToRGBA(u); return `rgba(${c.r},${c.g},${c.b},${(c.a / 255).toFixed(3)})`; };

/* ---------- hotkeys: WinForms Keys | Shift 0x10000 | Ctrl 0x20000 | Alt 0x40000 ---------- */
const MOD_SHIFT = 0x10000, MOD_CTRL = 0x20000, MOD_ALT = 0x40000;
const VK_NAMES = (() => {
  const m = {0x01:"Mouse 1",0x02:"Mouse 2",0x04:"Mouse 3",0x05:"Mouse 4",0x06:"Mouse 5",0x08:"Back",0x09:"Tab",0x0C:"Clear",0x0D:"Enter",0x10:"Shift",0x11:"Ctrl",0x12:"Alt",0x13:"Pause",0x14:"CapsLock",0x1B:"Escape",0x20:"Space",0x21:"PageUp",0x22:"PageDown",0x23:"End",0x24:"Home",0x25:"Left",0x26:"Up",0x27:"Right",0x28:"Down",0x2C:"PrintScreen",0x2D:"Insert",0x2E:"Delete",0x5B:"LWin",0x5C:"RWin",0x5D:"Apps",0x6A:"Multiply",0x6B:"Add",0x6C:"Separator",0x6D:"Subtract",0x6E:"Decimal",0x6F:"Divide",0x90:"NumLock",0x91:"ScrollLock",0xA0:"LShiftKey",0xA1:"RShiftKey",0xA2:"LControlKey",0xA3:"RControlKey",0xA4:"LMenu",0xA5:"RMenu",0xBA:";",0xBB:"=",0xBC:",",0xBD:"-",0xBE:".",0xBF:"/",0xC0:"`",0xDB:"[",0xDC:"\\",0xDD:"]",0xDE:"'",0xDF:"Oem8",0xE2:"OemBackslash"};
  for (let i = 0; i < 10; i++) { m[0x30 + i] = String(i); m[0x60 + i] = "NumPad" + i; }
  for (let i = 0; i < 26; i++) m[0x41 + i] = String.fromCharCode(65 + i);
  for (let i = 0; i < 24; i++) m[0x70 + i] = "F" + (i + 1);
  return m;
})();
const VK_BY_NAME = Object.fromEntries(Object.entries(VK_NAMES).map(([k, v]) => [v.toLowerCase(), +k]));
Object.assign(VK_BY_NAME, {return: 0x0D, esc: 0x1B, control: 0x11, controlkey: 0x11, shiftkey: 0x10, menu: 0x12, prior: 0x21, next: 0x22, oemplus: 0xBB, oemminus: 0xBD, oemcomma: 0xBC, oemperiod: 0xBE, oemtilde: 0xC0, oemquestion: 0xBF, oemsemicolon: 0xBA, oemquotes: 0xDE, oempipe: 0xDC, oemopenbrackets: 0xDB, oemclosebrackets: 0xDD});
function hotkeyName(k){
  if (!k) return "";
  let s = "";
  if (k & MOD_SHIFT) s += "Shift + ";
  if (k & MOD_CTRL) s += "Ctrl + ";
  if (k & MOD_ALT) s += "Alt + ";
  const vk = k & 0xFFFF;
  return s + (VK_NAMES[vk] ?? ("Key0x" + vk.toString(16).toUpperCase()));
}
function parseHotkeyName(s){
  if (typeof s === "number") return s;
  s = String(s || "").trim();
  if (!s || /^none$/i.test(s)) return 0;
  const parts = s.split(/\s\+\s/);
  let k = 0;
  parts.forEach((part, idx) => {
    const p = part.trim(), lp = p.toLowerCase(), last = idx === parts.length - 1;
    if (!last && lp === "shift") k |= MOD_SHIFT;
    else if (!last && (lp === "ctrl" || lp === "control")) k |= MOD_CTRL;
    else if (!last && lp === "alt") k |= MOD_ALT;
    else if (/^key0x[0-9a-f]+$/i.test(p)) k |= parseInt(p.slice(5), 16);
    else if (lp in VK_BY_NAME) k |= VK_BY_NAME[lp];
    else throw new Error(`Unknown key "${p}" in hotkey "${s}"`);
  });
  return k;
}

/* ---------- conditions ---------- */
const CONDITION_FLAGS = "None=0,NormalConditions=1,Unconscious=2,Emoting=3,Mounted=4,Crafting=5,Gathering=6,MeldingMateria=7,OperatingSiegeMachine=8,CarryingObject=9,RidingPillion=10,InThatPosition=11,ChocoboRacing=12,PlayingMiniGame=13,PlayingLordOfVerminion=14,ParticipatingInCustomMatch=15,Performing=16,Occupied=25,InCombat=26,Casting=27,SufferingStatusAffliction=28,SufferingStatusAffliction2=29,Occupied30=30,OccupiedInEvent=31,OccupiedInQuestEvent=32,Occupied33=33,BoundByDuty=34,OccupiedInCutSceneEvent=35,InDuelingArea=36,TradeOpen=37,Occupied38=38,Occupied39=39,ExecutingCraftingAction=40,PreparingToCraft=41,ExecutingGatheringAction=42,Fishing=43,BetweenAreas=45,Stealthed=46,Jumping=48,UsingChocoboTaxi=49,OccupiedSummoningBell=50,BetweenAreas51=51,SystemError=52,LoggingOut=53,ConditionLocation=54,WaitingForDuty=55,BoundByDuty56=56,MountOrOrnamentTransition=57,WatchingCutscene=58,WaitingForDutyFinder=59,CreatingCharacter=60,Jumping61=61,PvPDisplayActive=62,SufferingStatusAffliction63=63,Mounting=64,CarryingItem=65,UsingPartyFinder=66,UsingHousingFunctions=67,Transformed=68,OnFreeTrial=69,BeingMoved=70,Mounting71=71,SufferingStatusAffliction72=72,SufferingStatusAffliction73=73,RegisteringForRaceOrMatch=74,WaitingForRaceOrMatch=75,WaitingForTripleTriadMatch=76,InFlight=77,WatchingCutscene78=78,InDeepDungeon=79,Swimming=80,Diving=81,RegisteringForTripleTriadMatch=82,WaitingForTripleTriadMatch83=83,ParticipatingInCrossWorldPartyOrAlliance=84,Unknown85=85,DutyRecorderPlayback=86,Casting87=87,MountImmobile=88,InThisState89=89,RolePlaying=90,InDutyQueue=91,ReadyingVisitOtherWorld=92,WaitingToVisitOtherWorld=93,UsingFashionAccessory=94,BoundByDuty95=95,Unknown96=96,Disguised=97,RecruitingWorldOnly=98,Unknown99=99,EditingPortrait=100,Unknown101=101,PilotingMech=102,EditingStrategyBoard=104"
  .split(",").map(p => { const [n, v] = p.split("="); return [+v, n]; });
const FLAG_NAME = Object.fromEntries(CONDITION_FLAGS);
const FLAG_BY_NAME = Object.fromEntries(CONDITION_FLAGS.map(([v, n]) => [n.toLowerCase(), v]));
Object.assign(FLAG_BY_NAME, {mounted2: 10, inthisstate88: 88});

const JOBS = [[1,"GLA","Gladiator"],[2,"PGL","Pugilist"],[3,"MRD","Marauder"],[4,"LNC","Lancer"],[5,"ARC","Archer"],[6,"CNJ","Conjurer"],[7,"THM","Thaumaturge"],[8,"CRP","Carpenter"],[9,"BSM","Blacksmith"],[10,"ARM","Armorer"],[11,"GSM","Goldsmith"],[12,"LTW","Leatherworker"],[13,"WVR","Weaver"],[14,"ALC","Alchemist"],[15,"CUL","Culinarian"],[16,"MIN","Miner"],[17,"BTN","Botanist"],[18,"FSH","Fisher"],[19,"PLD","Paladin"],[20,"MNK","Monk"],[21,"WAR","Warrior"],[22,"DRG","Dragoon"],[23,"BRD","Bard"],[24,"WHM","White Mage"],[25,"BLM","Black Mage"],[26,"ACN","Arcanist"],[27,"SMN","Summoner"],[28,"SCH","Scholar"],[29,"ROG","Rogue"],[30,"NIN","Ninja"],[31,"MCH","Machinist"],[32,"DRK","Dark Knight"],[33,"AST","Astrologian"],[34,"SAM","Samurai"],[35,"RDM","Red Mage"],[36,"BLU","Blue Mage"],[37,"GNB","Gunbreaker"],[38,"DNC","Dancer"],[39,"RPR","Reaper"],[40,"SGE","Sage"],[41,"VPR","Viper"],[42,"PCT","Pictomancer"]];
const JOB_ABBR = Object.fromEntries(JOBS.map(j => [j[0], j[1]]));
const JOB_BY_ABBR = Object.fromEntries(JOBS.map(j => [j[1].toLowerCase(), j[0]]));
const ROLES = [[1,"Tank"],[2,"Melee DPS"],[3,"Ranged DPS"],[4,"Healer"],[30,"DoW"],[31,"DoM"],[32,"DoL"],[33,"DoH"]];
const ROLE_NAME = Object.fromEntries(ROLES);
const TARGETS = ["Target","Focus Target","Soft Target"];
const KNOWN_ZONES = {732:"Eureka Anemos",763:"Eureka Pagos",795:"Eureka Pyros",827:"Eureka Hydatos",920:"Bozjan Southern Front",975:"Zadnor",1055:"Island Sanctuary"};

// arg kinds: null (no argument), flag, set, job, role, zone, charid, target, timespan, hud, hotkey, party, addon, plugin
const CONDITIONS = [
  {id:"cf", name:"Condition Flag", cat:"Game state", arg:"flag", def:26, help:"A Dalamud ConditionFlag, e.g. InCombat, Mounted, BoundByDuty."},
  {id:"cs", name:"Condition Set", cat:"Game state", arg:"set", def:0, help:"True when another condition set is true. Lets you reuse sets."},
  {id:"j", name:"Job", cat:"Character", arg:"job", def:19},
  {id:"r", name:"Role", cat:"Character", arg:"role", def:1, help:"Tank/Healer/DPS use the job's role. DoW/DoM/DoL/DoH use its class category."},
  {id:"c", name:"Character ID", cat:"Character", arg:"charid", def:0, help:"Your character's ContentId. Leave at 0 and it is auto-assigned when the set is imported in game."},
  {id:"z", name:"Zone", cat:"Location", arg:"zone", def:0, help:"TerritoryType row ID of the current zone."},
  {id:"is", name:"In Sanctuary", cat:"Location", arg:null, help:"Areas that accumulate rested experience."},
  {id:"em", name:"In Explorer Mode", cat:"Location", arg:null},
  {id:"l", name:"Is Logged In", cat:"Misc", arg:null},
  {id:"t", name:"Target Exists", cat:"Misc", arg:"target", def:0},
  {id:"wd", name:"Weapon Drawn", cat:"Misc", arg:null},
  {id:"pt", name:"# Party Member Exists", cat:"Misc", arg:"party", def:2, help:"True if party member <N> exists in the current area."},
  {id:"pe", name:"Pet Exists", cat:"Misc", arg:null},
  {id:"ce", name:"Chocobo Exists", cat:"Misc", arg:null},
  {id:"hl", name:"Current HUD Layout", cat:"Misc", arg:"hud", def:0},
  {id:"k", name:"Key Held", cat:"Misc", arg:"hotkey", def:0},
  {id:"et", name:"Eorzea Timespan", cat:"Time", arg:"timespan", def:"", help:"24h \"HH:MM-HH:MM\", X wildcards allowed (\"XX:30-XX:10\"). Start inclusive, end exclusive."},
  {id:"lt", name:"Local Timespan", cat:"Time", arg:"timespan", def:"", help:"Same format as Eorzea Timespan, using your PC clock."},
  {id:"ae", name:"Addon Exists", cat:"UI & Plugins", arg:"addon", def:"", help:"Name of a game UI window (see /xldata ai)."},
  {id:"av", name:"Addon Visible", cat:"UI & Plugins", arg:"addon", def:"", help:"Name of a game UI window (see /xldata ai)."},
  {id:"p", name:"Plugin Enabled", cat:"UI & Plugins", arg:"plugin", def:"", help:"The plugin's InternalName (case sensitive): its folder name in %AppData%\\XIVLauncher\\installedPlugins. /xlplugins shows the display name instead, which can differ (Allagan Tools is InventoryTools)."},
];
const COND_BY_ID = Object.fromEntries(CONDITIONS.map(c => [c.id, c]));
const COND_BY_NAME = Object.fromEntries(CONDITIONS.map(c => [c.name.toLowerCase(), c]));
const TIMESPAN_RE = /^([0-9Xx]{1,2}:[0-9Xx]{2})\s*-\s*([0-9Xx]{1,2}:[0-9Xx]{2})$/;

const setRef = (sets, i) => (i >= 0 && i < sets.length) ? `#${i + 1}: ${sets[i].n || "(unnamed)"}` : `#${i + 1}: (missing)`;
function condValueText(c, sets){
  const def = COND_BY_ID[c.i]; const a = c.a;
  if (!def) return isRaw(a) ? a.__raw : JSON.stringify(a);
  switch (def.arg) {
    case null: return "";
    case "flag": return FLAG_NAME[a] ?? String(a);
    case "set": return setRef(sets, a);
    case "job": return JOB_ABBR[a] ?? String(a);
    case "role": return ROLE_NAME[a] ?? String(a);
    case "zone": return KNOWN_ZONES[a] ? `${a} (${KNOWN_ZONES[a]})` : String(a);
    case "charid": return isRaw(a) ? a.__raw : String(a);
    case "target": return TARGETS[a] ?? String(a);
    case "hud": return "Layout " + (Number(a) + 1);
    case "hotkey": return hotkeyName(a) || "(none)";
    case "party": return "<" + a + ">";
    default: return typeof a === "string" ? (a || "(empty)") : String(a);
  }
}
function condText(c, sets){
  const def = COND_BY_ID[c.i];
  const v = condValueText(c, sets);
  return (c.n ? "NOT " : "") + (def ? def.name : `Unknown(${c.i})`) + (v ? ": " + v : "");
}

// Reorder / delete condition sets while keeping every reference (bars and "Condition Set" conditions) pointing at the same set
function remapSets(doc, mapOldToNew){
  for (const b of doc.BarCfgs) if (typeof b.c === "number" && b.c >= 0) { const nv = mapOldToNew(b.c); b.c = nv === null ? -1 : nv; }
  for (const s of doc.CndSetCfgs) {
    for (let j = s.c.length - 1; j >= 0; j--) {
      const cnd = s.c[j];
      if (cnd.i !== "cs" || typeof cnd.a !== "number") continue;
      const nv = mapOldToNew(cnd.a);
      if (nv === null) s.c.splice(j, 1); else cnd.a = nv;
    }
  }
}
function moveSet(doc, from, to){
  const order = doc.CndSetCfgs.map((_, i) => i);
  const [x] = order.splice(from, 1); order.splice(to, 0, x);
  const map = new Map(order.map((old, idx) => [old, idx]));
  remapSets(doc, i => map.has(i) ? map.get(i) : i);
  const [s] = doc.CndSetCfgs.splice(from, 1); doc.CndSetCfgs.splice(to, 0, s);
}
function removeSet(doc, i){
  remapSets(doc, x => x > i ? x - 1 : (x === i ? null : x));
  doc.CndSetCfgs.splice(i, 1);
}

/* ---------- copying between two configs (e.g. a set from another QoLBar.json) ---------- */
// Which of src's condition sets are needed: the chosen ones, the ones chosen bars use, and any sets
// those refer to through "Condition Set" rows (followed all the way down)
function setDependencies(src, setIdxs, bars){
  const need = new Set(setIdxs);
  for (const b of bars) if (typeof b.c === "number" && b.c >= 0 && src.CndSetCfgs[b.c]) need.add(b.c);
  const stack = [...need];
  while (stack.length) {
    const i = stack.pop();
    for (const c of src.CndSetCfgs[i]?.c || []) if (c.i === "cs" && typeof c.a === "number" && src.CndSetCfgs[c.a] && !need.has(c.a)) { need.add(c.a); stack.push(c.a); }
  }
  return need;
}
// Copies condition sets, bars and shortcuts from src into target and renumbers every set reference.
// A set identical to one already in target (and not pointing at other sets) is reused instead of duplicated.
function importFromDoc(target, src, {sets = [], bars = [], shortcuts = [], destList = null, withDeps = true} = {}){
  const need = withDeps ? setDependencies(src, sets, bars) : new Set(sets);
  const plain = s => !s.c.some(c => c.i === "cs");
  const sig = s => JSON.stringify([s.n, s.c.map(c => [c.i, isRaw(c.a) ? c.a.__raw : c.a, c.n, c.o])]);
  const map = new Map(), added = [];
  let reused = 0, dropped = 0, unlinked = 0;
  for (const i of [...need].sort((a, b) => a - b)) {
    const s = src.CndSetCfgs[i]; if (!s) continue;
    const dup = plain(s) ? target.CndSetCfgs.findIndex(t => plain(t) && sig(t) === sig(s)) : -1;
    if (dup >= 0) { map.set(i, dup); reused++; continue; }
    const copy = structuredClone(s); target.CndSetCfgs.push(copy); map.set(i, target.CndSetCfgs.length - 1); added.push(copy);
  }
  // Point "Condition Set" rows at the new numbers; rows whose set wasn't brought along are removed
  for (const s of added) s.c = s.c.filter(c => { if (c.i !== "cs" || typeof c.a !== "number") return true; if (map.has(c.a)) { c.a = map.get(c.a); return true; } dropped++; return false; });
  const newBars = bars.map(b => {
    const c = structuredClone(b);
    if (typeof b.c === "number" && b.c >= 0) { if (map.has(b.c)) c.c = map.get(b.c); else { c.c = -1; unlinked++; } }
    target.BarCfgs.push(c); return c;
  });
  const newShortcuts = destList ? shortcuts.map(sh => { const c = structuredClone(sh); destList.push(c); return c; }) : [];
  return {setsAdded: added.length, setsReused: reused, droppedRows: dropped, unlinkedBars: unlinked, bars: newBars, shortcuts: newShortcuts, setMap: map, firstNewSet: added.length ? target.CndSetCfgs.indexOf(added[0]) : -1};
}

/* ---------- in-game import / export strings (gzip + base64 of Newtonsoft JSON) ---------- */
const SHORT_TYPES = {e: "export", b2: T_BAR, s2: T_SH, cs: T_SET, c: T_CND};
function normalizeImported(o){
  if (Array.isArray(o)) return o.map(normalizeImported);
  if (o === null || typeof o !== "object" || isRaw(o)) return o;
  const kids = {};
  for (const k of Object.keys(o)) kids[k] = normalizeImported(o[k]);
  const full = SHORT_TYPES[o["$type"]] || o["$type"];
  const mk = {[T_SH]: makeShortcut, [T_BAR]: makeBar, [T_SET]: makeSet, [T_CND]: makeCond}[full];
  if (!mk) return kids;
  delete kids["$type"];
  const r = mk(kids); r["$type"] = full; return r;
}
function decodeExportJson(json){
  const o = parseConfig(json);
  if (!o || typeof o !== "object") throw new Error("Not an export object");
  if (o.b2) return {kind: "bar", value: normalizeImported(o.b2), version: o.v};
  if (o.s2) return {kind: "shortcut", value: normalizeImported(o.s2), version: o.v};
  if (o.cs) return {kind: "set", value: normalizeImported(o.cs), version: o.v};
  if (o.b1 || o.s1) throw new Error("This is a legacy (pre-2.0) QoLBar export. Import it in game once, then export it again.");
  throw new Error("The string decoded, but it holds no bar, shortcut or condition set.");
}
const SCALAR_DEFAULTS = {
  [T_SH]: {n:"",t:0,c:"",k:0,kP:false,m:0,cl:4294967295,clA:0,iZ:1,iR:0,cdA:0,cdS:0,cW:140,cSO:false,cC:1,cS:1,cF:1,cNB:false,cH:false,cHC:false,_i:0},
  [T_BAR]: {n:"",k:0,h:false,d:2,a:1,v:2,ht:false,bW:100,e:false,cT:false,l:false,co:0,s:1,rA:1,fS:1,nB:false,c:-1},
  [T_SET]: {n:""}, [T_CND]: {i:"cf",a:0,n:false,o:0}
};
const TYPE_SHORT = {[T_SH]: "s2", [T_BAR]: "b2", [T_SET]: "cs", [T_CND]: "c"};
// Mirrors QoLBar's export: short $type names, default values and nulls left out
function toExportObject(o){
  if (Array.isArray(o)) return o.map(toExportObject);
  if (o === null || typeof o !== "object" || isRaw(o)) return o;
  const t = o["$type"], defs = SCALAR_DEFAULTS[t] || {};
  const out = {};
  if (t) out["$type"] = TYPE_SHORT[t] || t;
  for (const k of Object.keys(o)) {
    if (k === "$type") continue;
    const v = o[k];
    if (v === null) continue;
    if (k in defs && defs[k] === v) continue;
    out[k] = toExportObject(v);
  }
  return out;
}
function encodeExportJson(kind, value, version){
  const key = {bar: "b2", shortcut: "s2", set: "cs"}[kind];
  return compactJson({"$type": "e", [key]: toExportObject(value), v: version || "2.3.3.9"});
}
async function gzipBase64(str){
  const buf = await new Response(new Blob([new TextEncoder().encode(str)]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  let bin = ""; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function gunzipBase64(b64){
  const bin = atob(b64.trim().replace(/\s+/g, ""));
  const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
}
async function exportString(kind, value, version){ return gzipBase64(encodeExportJson(kind, value, version)); }
async function importString(str){ return decodeExportJson(await gunzipBase64(str)); }

/* ---------- readable JSON: long names, enum names, hex colors, hotkey text ---------- */
const GLOBAL_HELP = {
  ExportOnDelete: "Copy a bar/shortcut's import string to the clipboard when it is deleted in game.",
  UseIconFrame: "Draw the hotbar frame around every icon by default.",
  AlwaysDisplayBars: "Ignore condition sets and always show every bar.",
  OptOutGameUIOffHide: "Keep bars visible when the game UI is hidden (Scroll Lock).",
  OptOutCutsceneHide: "Keep bars visible during cutscenes.",
  OptOutGPoseHide: "Keep bars visible in GPose.",
  NoConditionCache: "Re-check conditions every frame instead of caching them for 0.1s.",
  UseHRIcons: "Use high resolution icons by default.",
  BackupTimer: "Minutes between timed backups (0 disables).",
  PieOpacity: "Pie menu background opacity (0 to 255).",
  PieAlternateAngle: "Rotate pie slices by half a slice.",
  PiesAlwaysCenter: "Always open pies at the center of the screen.",
  PiesMoveMouse: "Move the mouse to the pie center when opened.",
  PiesReturnMouse: "Return the mouse to where it was when the pie closes.",
  PiesReadjustMouse: "Readjust the mouse if a pie is opened near the screen edge.",
  UsePenumbra: "Load icons through Penumbra (so icon mods show).",
  FontSize: "Font size used by bars.",
  PluginVersion: "Written by the plugin. Leave alone.",
  Version: "Config schema version. Leave alone."
};
function unwrapShortcut(sh){
  const o = {}; const p = parseName(sh.n);
  if (p.label) o.Label = p.label;
  if (p.hasIcon) o.Icon = p.args + p.iconRaw;
  if (p.hasTooltip) o.Tooltip = p.tooltip;
  o.Type = SH_TYPES[sh.t] ?? sh.t;
  if (sh.c) o.Command = sh.c.includes("\n") ? sh.c.split("\n") : sh.c;
  if (sh.k) o.Hotkey = hotkeyName(sh.k);
  if (sh.kP) o.KeyPassthrough = true;
  if (sh.m) o.Mode = SH_MODES[sh.m] ?? sh.m;
  if (sh.cl !== 4294967295) o.Color = colorToHex(sh.cl);
  if (sh.clA) o.ColorAnimation = ANIMS[sh.clA] ?? sh.clA;
  if (sh.iZ !== 1) o.IconZoom = sh.iZ;
  if (sh.iO && (sh.iO[0] || sh.iO[1])) o.IconOffset = sh.iO;
  if (sh.iR) o.IconRotationRadians = sh.iR;
  if (sh.cdA) o.CooldownAction = sh.cdA;
  if (sh.cdS) o.CooldownStyle = CD_FLAGS.filter(([b]) => sh.cdS & b).map(([, n]) => n).concat((sh.cdS & ~31) ? [sh.cdS & ~31] : []);
  const cat = {};
  if (sh.cW !== 140) cat.Width = sh.cW;
  if (sh.cC !== 1) cat.Columns = sh.cC;
  if (sh.cSp && (sh.cSp[0] !== 8 || sh.cSp[1] !== 4)) cat.Spacing = sh.cSp;
  if (sh.cS !== 1) cat.Scale = sh.cS;
  if (sh.cF !== 1) cat.FontScale = sh.cF;
  if (sh.cSO) cat.StaysOpen = true;
  if (sh.cNB) cat.NoBackground = true;
  if (sh.cH) cat.OpenOnHover = true;
  if (sh.cHC) cat.CloseWhenHoverEnds = true;
  if (Object.keys(cat).length) o.CategoryOptions = cat;
  if (sh._i) o._i = sh._i;
  const extra = {}; for (const k of Object.keys(sh)) if (!SH_KEYS.includes(k)) extra[k] = sh[k];
  if (Object.keys(extra).length) o._extra = extra;
  if (sh.sL !== null && sh.sL !== undefined) o.Shortcuts = sh.sL.map(unwrapShortcut);
  return o;
}
function enumIndex(list, v, what, path){
  if (typeof v === "number") return v;
  const norm = x => String(x).toLowerCase().replace(/[\s/]/g, "");
  const i = list.findIndex(x => norm(x) === norm(v));
  if (i < 0) throw new Error(`${path}: unknown ${what} "${v}". Valid: ${list.join(", ")}`);
  return i;
}
function wrapShortcut(o, path){
  const sh = shDefaults();
  const hasIcon = o.Icon !== undefined && o.Icon !== null;
  sh.n = buildName({label: o.Label || "", hasIcon, args: "", iconRaw: hasIcon ? String(o.Icon) : "", hasTooltip: o.Tooltip !== undefined && o.Tooltip !== null, tooltip: o.Tooltip ?? ""});
  sh.t = enumIndex(SH_TYPES, o.Type ?? "Command", "Type", path);
  sh.c = Array.isArray(o.Command) ? o.Command.join("\n") : (o.Command ?? "");
  try { sh.k = parseHotkeyName(o.Hotkey ?? 0); } catch (e) { throw new Error(`${path}: ${e.message}`); }
  sh.kP = !!o.KeyPassthrough;
  if (o.Mode !== undefined) sh.m = enumIndex(SH_MODES, o.Mode, "Mode", path);
  if (o.Color !== undefined) { const c = typeof o.Color === "number" ? o.Color : hexToColor(o.Color); if (c === null) throw new Error(`${path}: bad Color "${o.Color}" (use #RRGGBB or #RRGGBBAA)`); sh.cl = c; }
  if (o.ColorAnimation !== undefined) sh.clA = enumIndex(ANIMS, o.ColorAnimation, "ColorAnimation", path);
  if (o.IconZoom !== undefined) sh.iZ = o.IconZoom;
  if (o.IconOffset !== undefined) sh.iO = o.IconOffset;
  if (o.IconRotationRadians !== undefined) sh.iR = o.IconRotationRadians;
  if (o.CooldownAction !== undefined) sh.cdA = o.CooldownAction;
  if (o.CooldownStyle !== undefined) sh.cdS = (Array.isArray(o.CooldownStyle) ? o.CooldownStyle : [o.CooldownStyle]).reduce((acc, f) => {
    if (typeof f === "number") return acc | f;
    const hit = CD_FLAGS.find(([, n]) => n.toLowerCase() === String(f).toLowerCase());
    if (!hit) throw new Error(`${path}: unknown CooldownStyle "${f}"`);
    return acc | hit[0];
  }, 0);
  const cat = o.CategoryOptions || {};
  if (cat.Width !== undefined) sh.cW = cat.Width;
  if (cat.Columns !== undefined) sh.cC = cat.Columns;
  if (cat.Spacing !== undefined) sh.cSp = cat.Spacing;
  if (cat.Scale !== undefined) sh.cS = cat.Scale;
  if (cat.FontScale !== undefined) sh.cF = cat.FontScale;
  sh.cSO = !!cat.StaysOpen; sh.cNB = !!cat.NoBackground; sh.cH = !!cat.OpenOnHover; sh.cHC = !!cat.CloseWhenHoverEnds;
  if (o._i !== undefined) sh._i = o._i;
  if (o.Shortcuts !== undefined && o.Shortcuts !== null) sh.sL = o.Shortcuts.map((s, i) => wrapShortcut(s, `${path} > ${s.Label || s.Tooltip || "#" + (i + 1)}`));
  else if (sh.t === 1) sh.sL = [];
  if (o._extra) Object.assign(sh, o._extra);
  return sh;
}
function unwrapCond(c, sets){
  const def = COND_BY_ID[c.i]; const o = {};
  if (c.o) o.Op = OPERATORS[c.o] ?? c.o;
  if (c.n) o.Not = true;
  o.Condition = def ? def.name : c.i;
  const a = c.a;
  if (!def) o.Value = isRaw(a) ? a.__raw : a;
  else switch (def.arg) {
    case null: if (a !== 0) o.Value = a; break;
    case "flag": o.Value = FLAG_NAME[a] ?? a; break;
    case "set": o.Value = setRef(sets, a); break;
    case "job": o.Value = JOB_ABBR[a] ?? a; break;
    case "role": o.Value = ROLE_NAME[a] ?? a; break;
    case "charid": o.Value = isRaw(a) ? a.__raw : String(a); break;
    case "target": o.Value = TARGETS[a] ?? a; break;
    case "hud": o.Value = typeof a === "number" ? a + 1 : a; break;
    case "hotkey": o.Value = hotkeyName(a) || "None"; break;
    default: o.Value = a;
  }
  return o;
}
function wrapCond(o, rsets, path){
  const c = cndDefaults();
  const def = COND_BY_NAME[String(o.Condition).toLowerCase()] || COND_BY_ID[o.Condition];
  c.i = def ? def.id : String(o.Condition);
  if (o.Op !== undefined) c.o = enumIndex(OPERATORS, o.Op, "Op", path);
  c.n = !!o.Not;
  const v = o.Value;
  if (!def) { c.a = v ?? 0; return c; }
  const bad = () => { throw new Error(`${path}: bad Value "${v}" for ${def.name}`); };
  switch (def.arg) {
    case null: c.a = v ?? 0; break;
    case "flag": c.a = typeof v === "number" ? v : (FLAG_BY_NAME[String(v).toLowerCase()] ?? bad()); break;
    case "set": {
      if (typeof v === "number") { c.a = v; break; }
      const m = /^#(\d+)/.exec(String(v));
      if (m) { c.a = +m[1] - 1; break; }
      const i = rsets.findIndex(s => s.Name === v); if (i < 0) bad(); c.a = i; break;
    }
    case "job": c.a = typeof v === "number" ? v : (JOB_BY_ABBR[String(v).toLowerCase()] ?? bad()); break;
    case "role": c.a = typeof v === "number" ? v : (ROLES.find(r => r[1].toLowerCase() === String(v).toLowerCase()) || bad())[0]; break;
    case "charid": { const s = String(v ?? "0").trim(); if (!/^\d+$/.test(s)) bad(); c.a = Number.isSafeInteger(Number(s)) ? Number(s) : {__raw: s}; break; }
    case "target": c.a = typeof v === "number" ? v : enumIndex(TARGETS, v, "target", path); break;
    case "hud": c.a = typeof v === "number" ? v - 1 : bad(); break;
    case "hotkey": try { c.a = parseHotkeyName(v); } catch (e) { throw new Error(`${path}: ${e.message}`); } break;
    default: c.a = v ?? def.def;
  }
  return c;
}
function unwrapConfig(doc){
  const sets = doc.CndSetCfgs || [];
  const settings = {};
  for (const k of Object.keys(doc)) if (!["$type", "BarCfgs", "CndSetCfgs"].includes(k)) settings[k] = doc[k];
  return {
    _about: "Readable QoLBar config made by QoLBar Editor. Edit it, then load it back with Import / Export > Import readable JSON and save. Omitted fields use plugin defaults. Colors are #RRGGBBAA. Hotkeys look like \"Ctrl + R\". Condition sets are referenced as \"#<number>: name\" and are checked strictly left to right.",
    Settings: settings,
    ConditionSets: sets.map(s => ({Name: s.n, Conditions: s.c.map(c => unwrapCond(c, sets))})),
    Bars: (doc.BarCfgs || []).map(b => {
      const o = {Name: b.n};
      if (b.k) o.Hotkey = hotkeyName(b.k);
      if (b.h) o.Hidden = true;
      if (b.c >= 0) o.ConditionSet = setRef(sets, b.c);
      o.Dock = DOCK[b.d] ?? b.d; o.Align = ALIGN_KEYS[b.a] ?? b.a; o.Visibility = VISIBILITY[b.v] ?? b.v;
      if (b.ht) o.Hint = true;
      o.ButtonWidth = b.bW; o.Columns = b.co; o.Scale = b.s; o.FontScale = b.fS; o.RevealAreaScale = b.rA; o.Spacing = b.sp; o.Position = b.p;
      if (b.l) o.LockedPosition = true;
      if (b.nB) o.NoBackground = true;
      if (b.cT) o.ClickThrough = true;
      if (b.e) o.Editing = true;
      const extra = {}; for (const k of Object.keys(b)) if (!BAR_KEYS.includes(k)) extra[k] = b[k];
      if (Object.keys(extra).length) o._extra = extra;
      o.Shortcuts = (b.sL || []).map(unwrapShortcut);
      return o;
    })
  };
}
function wrapConfig(r){
  if (!r || !Array.isArray(r.Bars)) throw new Error("This is not a readable QoLBar file (no \"Bars\" list).");
  const rsets = r.ConditionSets || [];
  const doc = {"$type": T_CONFIG};
  doc.BarCfgs = r.Bars.map((o, bi) => {
    const path = `Bar "${o.Name ?? bi + 1}"`;
    const b = barDefaults();
    b.n = o.Name ?? "";
    try { b.k = parseHotkeyName(o.Hotkey ?? 0); } catch (e) { throw new Error(`${path}: ${e.message}`); }
    b.sL = (o.Shortcuts || []).map((s, i) => wrapShortcut(s, `${path} > ${s.Label || s.Tooltip || "#" + (i + 1)}`));
    b.h = !!o.Hidden;
    if (o.Dock !== undefined) b.d = enumIndex(DOCK, o.Dock, "Dock", path);
    if (o.Align !== undefined) b.a = enumIndex(ALIGN_KEYS, o.Align, "Align", path);
    if (o.Visibility !== undefined) b.v = enumIndex(VISIBILITY, o.Visibility, "Visibility", path);
    b.ht = !!o.Hint; b.e = !!o.Editing; b.cT = !!o.ClickThrough; b.l = !!o.LockedPosition; b.nB = !!o.NoBackground;
    if (o.ButtonWidth !== undefined) b.bW = o.ButtonWidth;
    if (o.Position !== undefined) b.p = o.Position;
    if (o.Columns !== undefined) b.co = o.Columns;
    if (o.Scale !== undefined) b.s = o.Scale;
    if (o.RevealAreaScale !== undefined) b.rA = o.RevealAreaScale;
    if (o.FontScale !== undefined) b.fS = o.FontScale;
    if (o.Spacing !== undefined) b.sp = o.Spacing;
    if (o.ConditionSet !== undefined && o.ConditionSet !== null && o.ConditionSet !== -1) {
      const m = /^#(\d+)/.exec(String(o.ConditionSet));
      if (typeof o.ConditionSet === "number") b.c = o.ConditionSet;
      else if (m) b.c = +m[1] - 1;
      else { const i = rsets.findIndex(s => s.Name === o.ConditionSet); if (i < 0) throw new Error(`${path}: no condition set named "${o.ConditionSet}"`); b.c = i; }
    }
    if (o._extra) Object.assign(b, o._extra);
    return b;
  });
  doc.CndSetCfgs = rsets.map((s, si) => ({"$type": T_SET, n: s.Name ?? "", c: (s.Conditions || []).map((c, ci) => wrapCond(c, rsets, `Condition set "${s.Name ?? si + 1}" row ${ci + 1}`))}));
  Object.assign(doc, r.Settings || {});
  return doc;
}

/* ---------- tree helpers ---------- */
function walkShortcuts(list, fn, parent = null){
  (list || []).forEach((sh, i) => { fn(sh, {list, index: i, parent}); if (sh.sL) walkShortcuts(sh.sL, fn, sh); });
}
function allShortcuts(doc){ const out = []; for (const b of doc.BarCfgs) walkShortcuts(b.sL, (sh, ctx) => out.push([sh, {...ctx, bar: b}])); return out; }
