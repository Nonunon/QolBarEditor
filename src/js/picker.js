// SPDX-License-Identifier: AGPL-3.0-or-later
// The icon picker: QoLBar's tabs, search, and the sheet cropper.
"use strict";

/* ---------- icon picker ----------
   Same tabs and ranges as QoLBar's own icon browser (IconBrowserUI.cs). Which IDs exist comes from QoLBar's
   iconCache.json (it scans the game files and saves the list) when you have it, otherwise from a built-in copy.
   Images load from xivapi only as tiles scroll into view, a few at a time. */
const ICON_TABS = [
  ["★", [[0, 100, "System"], [62000, 62600, "Classes/Jobs"], [62800, 62900, "Gearsets"], [66000, 66400, "Macros"], [90000, 100000, "FC Crests/Symbols"], [114000, 114100, "New Game+"], [230850, 231000, "Classes/Jobs (GPose)"], [10000000, 10003000, "Extra (UI sheets)"]]],
  ["Misc", [[60000, 61000, "UI"], [61200, 61250, "Markers"], [61290, 61390, "Markers 2"], [61390, 62000, "UI 2"], [62600, 62620, "HQ FC Banners"], [63900, 64000, "Map Markers"], [64500, 64550, "Stamps"], [65000, 65900, "Currencies"], [180000, 180060, "Chocobo Racing"], [230000, 230850, "GPose"], [231000, 240000, "GPose 2"]]],
  ["Misc 2", [[62900, 63200, "Achievements/Hunting Log"], [63875, 63900, "Cosmic Exploration"], [65900, 66000, "Fishing"], [66400, 66500, "Tags"], [67000, 68000, "Fashion Log"], [70120, 70200, "Animals"], [70500, 70960, "Cosmic Exploration 2"], [70960, 71450, "Quests"], [72000, 72500, "BLU UI"], [72500, 72620, "Bozja UI"], [76000, 76200, "Mahjong"], [80000, 80200, "Quest Log"], [80730, 81000, "Relic Log"], [82000, 82100, "Misc UI"], [82270, 82325, "Occult Crescent UI"], [83000, 84000, "FC Ranks"], [180060, 180100, "UI Text"], [240000, 241000, "Strategy Board"]]],
  ["Actions", [[100, 4000, "Classes/Jobs"], [5100, 8000, "Traits"], [8000, 9000, "Fashion"], [9000, 10000, "PvP"], [19600, 19800, "Event"], [19800, 20000, "Mount"], [61250, 61290, "Duties/Trials"], [64200, 64325, "FC"], [64550, 64600, "Occult Crescent"], [64600, 64800, "Eureka"], [64800, 65000, "NPC"], [70000, 70120, "Chocobo Racing"], [82200, 82270, "Occult Crescent 2"], [246000, 250000, "Emotes"]]],
  ["Mounts & Minions", [[4000, 4400, "Mounts"], [4400, 5100, "Minions"], [59000, 59400, "Mounts... again?"], [59400, 60000, "Minion Items"], [68000, 68400, "Mounts Log"], [68400, 69000, "Minions Log"]]],
  ["Items", [[20000, 30000, "General"], [50000, 54000, "Housing"], [58000, 59000, "Fashion"]]],
  ["Equipment", [[30000, 50000, "Equipment"], [54000, 54225, "Belts"], [54225, 54400, "Flowers"], [54400, 58000, "Special Equipment"], [200000, 210000, "Glasses"]]],
  ["Aesthetics", [[130000, 142000, ""], [250000, 251001, ""]]],
  ["Statuses", [[210000, 230000, ""]]],
  ["Garbage", [[61000, 61100, "Splash Logos"], [62620, 62800, "World Map"], [63200, 63875, "Zone Maps"], [66500, 67000, "Gardening Log"], [69000, 70000, "Mount/Minion Footprints"], [70200, 70500, "DoH/DoL Logs"], [71450, 71500, "Credits"], [78000, 80000, "Fishing Log"], [80200, 80730, "Notebooks"], [81000, 82000, "Notebooks 2"], [82100, 82200, "Housing"], [84000, 85000, "Hunts"], [85000, 87000, "Large UI"], [150000, 170000, "Tutorials"], [190000, 200000, "Adventurer Plates"], [241000, 241200, "Cosmic Exploration Zones"]]],
  ["Spoilers", [[87000, 90000, "Triple Triad"], [72620, 76000, "Duty Support"], [120000, 130000, "Popup Texts"], [142000, 150000, "Japanese Popup Texts"], [181000, 181500, "Boss Titles"]]],
  ["Spoilers 2", [[71500, 72000, "Credits"], [100000, 114000, "Quest Images"], [114100, 120000, "New Game+"]]],
  ["Unsorted", [[10000, 19600, ""], [61100, 61200, ""], [64000, 64200, ""], [64325, 64500, ""], [76200, 78000, ""], [82325, 83000, ""], [181500, 190000, ""], [241200, 246000, ""], [251001, 350000, ""]]],
];
// Which icon IDs exist in the game, as "gap.length" runs in hex (from QoLBar's iconCache.json, 2026-05-07)
const ICON_SNAPSHOT_DATE = "May 2026";
const ICON_SNAPSHOT = "0.60,1.1,2.2a,8.12,20.14,1e.12,20.12,20.14,1e.13,1f.13,1f.13,6.8,11.8,2.8,20.15,1d.6,27.4,1.26,c.1d,1.9,1.6,4.b,9.b,9.b,9.c,8.c,8.7,12.e,3d.94,160.2a,8.29,9.2b,7.2c,6.29,9.2a,8.2a,8.2b,7.6,13.2,17.32,32.1,18.4,15.1,18.4,15.2,15c.22,1.c2,1.8,c.28,a.1e,5.5,5.b,13.9,10.24,e.7,12.d,c.c5,3.2d,5.80,16.28,a.24,e.9,29.12,20.27,b.29,9.2e,36.2d,37.1,63.2e,1.129,1.2,1.1,7.1,2.1,28.7a,1.59,1.15e,1.a,2.8,1.1,4.1,4.1,68.2,8.5,5.5,5.5,5.5,5.5,19.b,9.4a,1.18,1.c8,19.3,48.2,30.7,12.18,1.b,e.2,111.1b,17.15,1d.19,19.e,24.11,21.2,30.c,26.10,22.f,23.d,25.c,26.c,26.1,c7.7,12.9,10.3,61.9,10.17,3ea.15,1.20,3b2.11,21.2a,8.2c0,7.3,7.3,7.3,7.3,7.3,15.9,10.49,259b.84,44.3b,5b.4,3.1,2a.33,95.65,63.8,c0.6,e.b,9.b,9.10,4.6,e.12,52.26,3e.1a,18.1b,17.17,98.1,18.8c,6e.2e,68.1a,18.2c,6a.25,3f.c,26.a,28.26,a2.14,1e.11,21.8,5c.1c,16.16,1c.10,54.6f,59.16,1c.3,93.4,2e.3,2f.9,29.9,29.2,30.4,2e.2,c6.7d,4b.2e,36.b4,14.7d,19.17,1b.9,10.5,14.e,24.27,b.17,1b.1a,18.9,10.1,20c.3e,26.b,27.b,27.29,9.5,2d.24,e.b,27.e,24.4,2e.f4,9c.bb,1.2,a.1e,14.37,14.b,e.44,7.1b,30.11,1.4,2.28,24.c1,3.1,11b.63,15.b,59.d,1b.3,11.9,b.2,76.a,28.25,d.2,30.d,25.2a,8.8,2.d,7.7,d.8,c.8,c.8,c.8,c.b,9.b,9.b,9.b,31.1a,18.7,3.3,2.b,18.a8,e8.170,b6.14,1e.276,14.e,24.76,20.14,1e.2a,8.a,f.6,13.125,1.1,37.4,6.4,6.5,5.5,5.7,3.130,1.1,5e.44,1.1,82.116,1.1,78.118,1.1,76.10c,1.1,82.c7,1.63,1.1,63.c6,2.72,1.1,54.ac,1c.1c6,1.1,90.e9,1.1,a5.147,1.1,47.7e,1.1,48.114,18.49,1b.49,1b.49,1b.43,21.49,1b.49,1b.4a,e2.7c,1.2,49.7b,1.2,4a.b6,1.1,74.b5,1.1,75.5a,1.2,6b.5e,1.2,67.39,1.2,8c.43,1.2,82.3a,2.2,8a.49,1b.49,1b.38,2c.12,52.10,54.13,1e1.11,53.10,54.10,54.f,55.10,54.10,54.f,55.12,b6.a,f.1,18.1,31.18b,5.ae,1.d3,1.cb,a.18c,1.7f,1.424,2.16c,1.259,16.c98,1.49d,1.ef,4.48,3.27e,c.270,1.11e,1.28,49.4,15.14,50.12,52.31,33.10,54.31,33.14,50.13,51.11,53.3a,8e.3b,29.3a,2a.41,23.1c5,2.5,8c.7,12.4,4.2,2.4,2.2,2.2,33.34,30.306,4.a,70.199,1.8d,2.1,7.3,1.1,1.1,1.1,82.24,4.1,1.5,99.2c,38.30,2.a5,a.ad,2.16e,22.13c,54.172,1.1,1c.139,57.55,1.161,1.7,c.3,5.a,17.46,1.16d,1.7,9.3,3.1,1.9,5.14,5.fd,6.69,1.7,12.3,4.1,1.3a,1.7,b.3,5.125,3.3e,1.19,1.50,1.7,c.3,4.a,1.1,c.15,1.20,f6.48,80.145,af.2e,1.129,1.2,1.1,7.1,2.1,28.7a,1.59,1.15e,1.a,2.8,1.1,4.1,4.1,5.4,6.3,6.3,2.1c,7.7,3.5,5.2,8.9,1.5c,8.b4,14.53,c.4,1.9,1.6,19.3,1.3,1.23,1.1e,5.3,1.3,1.3,9.17,2.4,1.4,6.14,14.9,1.7,d.2b,7.d,8.29,8.4,6.9,1.4,6.67,11.13,1.6,4.14,82.9,1.9,1.9,1.5,5.9,1.20,8.7,3.9,1.9,1.9,1.5,5.9,1.1e,a.e,6.f,5.a,a.4,6.4,6.14,a.31,1.31,1.d,7.d,2.2,3.11,3.f,5.7,3.4,1.12,7.4,6.4,10.13,1f.36,1.2,12.6,13.16,12.2,12.3,11.3,7.1,9.30,34.31,33.5,14.2c,1f.15,4f.18,4c.12,2.4,2e.7,3.a,a.6,e.b,9.8,c.a,a.5,f.2,12.5,f.3,39.2c,38.28,a.1f,13.79,1e.7,d.9,1.1,9.7,3.c,8.8,c.b,9.6,e.1,13.4,10.2,12.4,10.3,11.3,2.2,3.2,3.3,2.b,9.4,1.4,1bd.74,d1.15,4.15,4.15,13.9,1.9,bf.1,31.2b,8.14f,7.7,32.81,1.9,2f9.25,3f.2,12.4,7.3,6.4,7.3,6.4,7.3,6.4,10.6,e.6,e.6,e.c,8.c,6c.2a,3a.18,1a.18,1a.14,1e.d,25.c,26.12,20.5,14.7,12.f4,6.15,1.20,3b2.2e,1.129,1.2,1.1,7.1,2.1,28.7a,1.59,1.15e,1.a,2.8,1.1,4.1,4.1,4.2e,1.129,1.2,1.2,6.1,2.1,28.7a,1.59,1.15e,1.a,2.8,1.1,4.1,4.1,4.44,20.d,7.2c,24.d,7.17,39.3c,29.31,32.32,33.1e,45.33,31.4e,3.4,1.4,46.11,3.11,3.7,3.7,3.7,3.7,3.7,3.7,3.7,3.7,3.7,3.7,3.3,7.4,6.7,3.7,3.7,3.7,2b.7,3.7,3.7,3.7,3.7,3.7,3.7,3.7,3.7,3.7,3.3,7.4,6.7,3.7,3.7,3.7,5e.30,1.32,a.1a,e.1a,e.20,8.27,1.21,7.27,1.1c,2.3a,2.26,2.1d,29.40,6.2,1c.3d,27.7e,86.b,a.5,4.7,3.36,1.36,1.7,3.2d,f.29,13.3c,c8.118,1.a,1fe.55,842.26,2.26,2.26,2.a,74e.a8,e8.170,b6.14,1e.276,14.e,24.76,20.14,1e.2a,8.a,f.6,13.6,4.9,1.37,19.e,1.15,e.c,d.b,e.5b,6d.15,9.15,9.15,13.34,30.79,9.f,5.f,5.f,5.f,5.13,1.13,1.29,6d.61,3.3e,8.15,9.24,e.2f,3.2e,68.14,1e.61,3.3e,8.15,9.24,e.2f,3.2e,36.2e,4.2e,4.b,1.7,1.11,3.a,1.b,8.7,3.5,5.8,2.16,4e.d,39.19,5.c,2b0.16,1c.16,1c.16,b2.16,1c.16,1c.16,b2.15,1d.15,1d.15,117.93,3.65,4.12,2.de,3.14d,a7.19,4c.22,16e.45,1.73,1.2,1.a,7.a,54.63,1.63,1.a6,1.ad,11.1,1ba.14,50.12,3e.6,d.1da,20e.1da,5f6.5,c3.40,88.40,218.bb,139.bb,139.bb,139.bb,139.bb,139.bb,139.bb,139.bb,139.5,1384.1ec,1.48,1.376,1.4,2.2,3.2,1.7,1.2,1.2,b.4,2139.cb,31d.e,6.2,12.b,31.3,2.3,37c.291,1.3,7.3,148.a1,347.c,26.c,26.c9,1.1,61.c9,1.1,61.c9,1.1,13ea.2,8.2,8.6,4.5,5.3,7.5,5.1,2.1,3.6,7.6,4.8,2.9,1.9,1.7,2.8,2.4,1.3,2.7,3.3,2.3,3.a,4.3,2.2,9.15,1.7,1.2a,7.6,4.9,1.62,8.5e,1.23,4.2,3b.8,2.8,1.3c,15.2a,3a.9,1.9,1.9,1.b,1.2,37.1a,1.b,1.5,7.8,2a.2,3.3,2.3,2.3,2.2,8.3,7.2,8.3,7.2,8.3,2.3,2.2,8.3,7.4,6.3,1.3,1.4,4e.3,7.2,8.3,7.3,7.3,1.4,1.3,1.2,1.2,1.3,1.2,b9.22,1.7,7.3,7.5,5.3,7.5,5.2,8.4,6.4,6.3,7.5,5.5,5.7,3.f,5.4,6.10,4.3,2.1,5.4,6.4,5.2,3.4,1.13,1.7,3.4,7.8,2.8,2.3,7.7,3.e,6.3,11.5,f.1,12.2,8.2,8.5,5.2,3.2,4.2,62.26,3e.3,5.1,37b.b,59.d,57.8,5c.6,5e.2,c6.4,60.2,8.4,6.4,6.3,7.9,2.a,5.9,e1.11,8.10,1.11,2.13,1.12,1.18,1.e,2.f,4.d,1b.12,7.19,2.19,17.14,2.19,3.4,2e.1,31.1b,17.7,3.5,5.4,6.5,f.1d,15.3,11.3,2.4,2.4,41.3,11.1,13.11,1.1,1.a,1.2,1b.e,24.14,1e.14,1e.9,29.1e,14.1,1.1c,14.1e,366.8,2.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,12.1,63.c,58.8,1.3,58.3,61.1,1f3.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,2.3,2.3,7.3,7.3,7.3,2.3,2.3,1.2,1.2,1.2,1.2,2.3,1.2,2.3,1.a,317.c,26.2d,2.e,2.f,2.f,2.11,2.a,2.2d,2.13,2.1a,2.d,2.11,2.10,2.2d,2.9,2.57,2.33,1.3b,1.1,3.4,10.1,53b.20,8.c,8.b,9.b,9.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,32.6c,2.8,2.8,2.8,2.8,2.8,2.8,2.8,16.6a,4.8,2.8,2.8,2.8,2.8,8e.69,5.8,2.8,2.8,2.8,34.62,2.5,5.8,2.8,2.8,2.8,98.60,4.5,5.8,2.8,2.8,2.8,34.69,5.8,2.8,2.8,2.8,fc.5,5.8,2.8,2.8,2.8,98.5,5.8,2.8,2.8,2.8,98.61,3.5,5.8,2.8,2.8,2.8,34.69,5.8,2.8,2.8,2.8,fc.5,5.8,2.8,2.8,2.8,98.5,5.8,2.8,2.8,2.8,98.5f,5.5,5.8,2.8,2.8,2.8,2a.9,1.69,5.8,2.8,2.8,2.8,2a.9,c9.5,5.8,2.8,2.8,2.8,2a.9,65.5,5.8,2.8,2.8,2.8,2a.9,65.69,5.8,2.8,2.8,2.8,34.62,2.5,5.8,2.8,2.8,2.8,fc.5,5.8,2.8,2.8,2.8,98.5,5.8,2.8,2.8,2.8,98.5f,5.5,5.8,2.8,2.8,2.8,2a.5,5.61,3.5,5.8,2.8,2.8,2.8,2.5,f5.5,5.8,2.8,2.8,2.8,2a.5,69.5,5.8,2.8,2.8,2.8,2a.5,69.53,2.6,9.9,1.8,2.8,2.8,2.8,2.8,2.8,2.8,2.8,2.5,5.34,2.7,27.9,1.8,2.8,2.8,2.8,2.8,2.8,2.8,2.8,2.5,5.6,4.6,b8.9,1.8,2.8,2.8,2.8,2.8,2.8,2.8,2.8,2.5,69.9,1.8,2.8,2.8,2.8,2.8,2.8,2.8,2.8,2.5,5.6,4.6,54.60,2.7,5.8,2.8,2.8,2.8,2a.5,5.61,2.6,5.8,2.8,2.8,2.8,2a.5,cd.5,5.8,2.8,2.8,2.8,2a.5,69.5,5.8,2.8,2.8,2.8,2a.5,69.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a.1e,a83.26,3e.3,5.1,37b.b,59.d,57.8,5c.6,5e.2,c6.4,60.2,8.4,6.4,6.3,7.9,2.a,5.9,e1.11,8.10,1.11,2.13,1.12,1.18,1.e,2.f,4.d,1b.12,7.19,2.19,17.14,2.19,3.4,2e.1,31.1b,17.7,3.5,5.4,6.5,f.1d,15.3,11.3,2.4,2.4,41.3,11.1,13.11,1.1,1.a,1.2,1b.e,24.14,1e.14,1e.9,13b0.1,9.3,7.3,7.3,7.3,7.2,8.2,12.1,1.3,f.3,7.3,7.2,8.4,6.4,6.4,6.3,11.3,7.2,8.3,11.3,7.4,6.4,6.4,6.4,6.3,7.4,6.6,4.5,5.4,6.3,7.3,7.4,6.3,7.5,f.4,6.3,7.4,6.5,5.3,7.2,8.2,8.4,6.7,3.4,6.5,5.3,7.4,6.3,7.3,7.3,7.3,11.4,6.1,1.3,5.3,7.3,7.3,7.2,8.3,7.6,4.5,f.3,7.2,8.3,7.3,7.3,7.3,7.2,8.2,8.2,8.2,8.2,8.6,4.1,9.3,7.3,7.3,7.2,8.2,8.2,8.2,8.5,5.2,8.4,6.2,8.6,4.5,5.3,7.5,5.3,7.3,7.4,6.5,5.4,6.4,6.5,5.5,5.4,6.3,7.3,7.2,8.3,1.1,5.4,6.3,7.2,8.2,8.2,8.2,8.5,5.4,6.3,7.4,6.3,7.2,8.4,6.2,8.2,8.4,6.4,6.4,6.2,8.3,7.3,7.3,7.2,8.2,8.3,7.4,6.4,6.3,7.2,8.3,7.3,7.4,6.2,8.5,5.5,5.5,5.7,3.3,7.3,7.5,5.3,7.4,6.5,5.3,1.1,5.3,7.3,7.5,5.2,8.5,5.3,7.3,7.4,6.4,6.3,7.4,6.3,7.4,6.4,6.4,6.2,8.3,7.3,7.3,7.3,7.4,6.4,6.4,6.4,6.3,7.4,6.3,7.3,7.3,7.4,6.3,7.5,5.6,4.3,7.3,7.4,6.6,4.3,7.4,6.2,8.3,7.3,7.2,8.3,7.4,6.4,6.3,7.4,6.2,8.2,8.5,5.5,5.4,6.5,5.3,7.3,7.2,8.4,6.4,6.5,5.3,7.3,7.4,6.4,6.3,7.2,8.3,7.5,5.5,5.3,7.2,8.3,7.3,7.2,8.3,7.2,8.5,5.3,7.3,7.4,6.3,7.3,7.5,5.6,4.5,5.6,4.3,7.2,8.5,5.2,8.6,4.2,8.4,6.5,5.5,5.4,6.4,6.2,8.5,5.5,5.4,6.2,8.4,6.3,7.6,4.2,8.2,8.5,5.3,7.2,8.2,8.2,8.3,7.3,7.3,7.6,4.3,7.5,5.3,7.3,7.5,5.4,6.4,6.3,7.2,8.3,7.7,3.5,5.3,7.3,7.3,7.3,7.3,7.3,7.2,8.3,7.2,8.2,8.4,6.3,7.7,3.2,8.4,6.4,6.3,7.3,7.3,7.4,24.3,7.3,7.3,7.2,8.2,3a.2,102.4,196.3,11.3,89f.3,7.3,7.3,7.2,8.2,3a.2,102.4,196.3,11.3,3383.1,9.3,7.3,7.3,7.3,7.2,8.2,12.1,1.3,f.3,7.3,7.2,8.4,6.4,6.4,6.3,11.3,7.2,8.3,11.3,7.4,6.4,6.4,6.4,6.3,7.4,6.6,4.5,5.4,6.3,7.3,7.4,6.3,7.5,f.4,6.3,7.4,6.5,5.3,7.2,8.2,8.4,6.7,3.4,6.5,5.3,7.4,6.3,7.3,7.3,7.3,11.4,6.1,1.3,5.3,7.3,7.3,7.2,8.3,7.6,4.5,f.3,7.2,8.3,7.3,7.3,7.3,7.2,8.2,8.2,8.2,8.2,8.6,4.7,3.3,7.3,7.3,7.2,8.2,8.2,8.2,8.5,5.2,8.4,6.2,8.6,4.5,5.3,7.5,5.3,7.3,7.4,6.5,5.4,6.4,6.5,5.5,5.4,6.3,7.3,7.2,8.3,1.1,5.4,6.3,7.2,8.2,8.2,8.2,8.5,5.4,6.3,7.4,6.3,7.2,8.4,6.2,8.2,8.4,6.4,6.4,6.2,8.3,7.3,7.3,7.2,8.2,8.3,7.4,6.4,6.3,7.2,8.3,7.3,7.4,6.2,8.5,5.5,5.5,5.7,3.3,7.3,7.5,5.3,7.4,6.5,5.3,1.1,5.3,7.3,7.5,5.2,8.5,5.3,7.3,7.4,6.4,6.3,7.4,6.3,7.4,6.4,6.4,6.2,8.3,7.3,7.3,7.3,7.4,6.4,6.4,6.4,6.3,7.4,6.3,7.3,7.3,7.4,6.3,7.5,5.6,4.3,7.3,7.4,6.6,4.3,7.4,6.2,8.3,7.3,7.2,8.3,7.4,6.4,6.3,7.4,6.2,8.2,8.5,5.5,5.4,6.5,5.3,7.3,7.2,8.4,6.4,6.5,5.3,7.3,7.4,6.4,6.3,7.2,8.3,7.5,5.5,5.3,7.2,8.3,7.3,7.2,8.3,7.2,8.5,5.3,7.3,7.4,6.3,7.3,7.5,5.6,4.5,5.6,4.3,7.2,8.5,5.2,8.6,4.2,8.4,6.5,5.5,5.4,6.4,6.2,8.5,5.5,5.4,6.2,8.4,6.3,7.6,4.2,8.2,8.5,5.3,7.2,8.2,8.2,8.3,7.3,7.3,7.6,4.3,7.5,5.3,7.3,7.5,5.4,6.4,6.3,7.2,8.3,7.7,3.5,5.3,7.3,7.3,7.3,7.3,7.3,7.2,8.3,7.2,8.2,8.4,6.3,7.7,3.2,8.4,6.4,6.3,7.3,7.3,7.4,24.3,7.3,7.3,7.2,8.2,3a.2,102.4,196.3,11.3,89f.3,7.3,7.3,7.2,8.2,3a.2,102.4,196.3,11.3,c74.8,c.8,2.1,8.6,4.a,1.21,2.3,1.4,2e.4,1b.2,3.3,2.8,2.e,ec.2,30.6b,189.22,1.5,1.5,1.14,1.5,1.a,1.5,1.a,1.8,1.14,1.5,1.7,1.5,1.a,1.3,2281.26,a3.2b,39.17,4d.e1,19.17,1b.3b,8d.3,2f.14,14.3,6.1d,110.17,4d.e1,1c.14,1b.33,95.3,60.1c,111.17,4d.e1,1c.14,1b.4d,7b.3,2f.14,14.3,6.18,b1.2b,39.16,14b.14,1b.4d,7b.2,30.14,1d.16,b3.2b,39.17,179.8,123.d,281.14,1b.29,9f.2,61.19,1d.14,1b.29,3b.14,1d.11,54.4,60.14,211.c,bd.2b,39.17,14a.14,1b.2b,9d.2,61.17,277.14,1b.2c,9c.2,61.f,ba.2b,39.17,179.25,a3.2,30.14,1d.272,b.3c,24bb.3,2f.9,29.13,1f.11,21.8,2a.10,22.e,24.13,1f.10,9.6,45.d,183.e,24.9,29.17,179.2,30.5,2d.2,30.4,2e.4,2e.3,2f.3,2f.3,287.2a,8.16,3.10,9.2b,7.d,c.1d,6.3,7.2,8.4,10.3,2f.18,1.4,6.3,7.4,33.18,1.14,5.1a,18.19,19.4,15.3,16.1c,48.44,20.14,50.e,56.37,2d.18,4c.1e,14.9,4.4,4.7,16.3,2.a,55.14,50.7,12.b,40.13f,119.46,1e.f9,1.18,1.b,e.39f,49.1e,46.12,2.2b,25.3,2.4,5b.e,56.15,4.15,4.15,4.b,e.a8,20.10,4.13,1f.19,69.9,1.8,2.27,1.1d,1.9,1.3b,1.31,1.31,1.9,1.27,1.9,1.13,1.4d,3.11,3.11,3.9,1.9,1.11,3.11,3.11,3.9,1.1c,2.27,1.11,3.11,3.31,b.11,3.11,3.11,3.11,3.11,3.11,3.11,3.11,3.12,2.12,2.1d,b.11,3.11,3.11,3.11,3.31,b.11,3.55,8.10,b.9,b.11,3.62,2.1a,e.9,b.11,3.11,3.11,3.39,3.11,3.9,b.9,b.6,e.9,b.31,b.11,3.9,b.9,b.9,b.b,9.2e,e.11,3.1a,e.1d,b.b,9.11,3.11,3.11,3.11,3.b,9.6,e.6,e.6,e.6,e.1f,9.b,9.1d,b.9,b.1b,d.11,3.7,d.b,9.11,3.b,9.18,10.1a,e.11,3.6,e.9,b.4,10.4,1.13,1.13,1.13,10.9,b.5,5.5,5.5,5.5,5.25,3.11,3.11,3.11,3.b,9.c,8.11,3.11,3.11,3.11,3.1b,d.11,3.11,3.11,3.11,3.11,3.11,3.11,3.11,3.11,3.11,3.11,3.11,223b.3a,34a.64,1.1c,47.4,6.6,3.19,38.10,54.1b,49.22,42.21,43.a,f.5,1.b,8.3,2f.10,22.26,3.3,6.10,22.18,1a.41,24.10,22.13,b72.40,150.6,6.6,1.4,1.1,4.9,1.1,1.4,1.1,2.6,1.1,4.5,2.1,1.3,2.7,1.1,1.1,1.3,4.1,4.6,1.a,1.5,4.7,1.2,2.2,2.4,7.3,1.2,3.3,1.3,2.5,3.2,1.1,d.6,3.5,3.2,1.4,4.1,3.3,1.2,3.1,3.3,2.8,1.1,2.1,1.6,1.1,3.3,1.2,1.2,1.4,1.1,4.1,4.5,2.4,5.1,1.1,1.2,1.2,4.1,1.1,2.4,1.4,1.1,1.4,3.1,1.1,1.1,2.1,2.3,1.1,4.4,2.5,2.2,1.1,1.2,8.1,1.1,6.1,2.3,1.1,1.1,1.3,3.2,1.1,1.7,1.2,1.2,1.1,1.3,2.1,2.1,1.4,3.1,1.2,1.3,3.4,1.3,3.2,2.3,1.2,1.b,2.2,1.1,1.8,3.1,1.5,1.3,1.5,2.1,2.18,1.2,1.2,3.1,139f.b,d.11,3a.7,5e.12,51.6,2b7.67,380.1,1f3.1,1f3.1,bb7.5,5f.22,42.51,1.2b,2.90,2.2,dc5.1,63.4,18c.2,c6.2,c6.2,62.2,256.2,62.4";
const ICON_LIST = {set: null, source: "", at: 0};
function decodeRuns(str){ const s = new Set(); let at = 0; for (const part of str.split(",")) { const [g, l] = part.split(".").map(x => parseInt(x, 16)); at += g; for (let i = 0; i < l; i++) s.add(at + i); at += l; } return s; }
function iconList(){ if (!ICON_LIST.set) { ICON_LIST.set = decodeRuns(ICON_SNAPSHOT); ICON_LIST.source = "builtin"; } return ICON_LIST.set; }
function useIconCache(ids, at, {persist = true} = {}){
  if (!Array.isArray(ids) || !ids.length || !ids.every(Number.isInteger)) throw new Error("This doesn't look like QoLBar's iconCache.json.");
  ICON_LIST.set = new Set(ids); ICON_LIST.source = "yours"; ICON_LIST.at = at || Date.now();
  if (persist) idb.set("iconCache", {ids, at: ICON_LIST.at}).catch(() => {});
}
async function loadIconCacheFromDir(dir){
  try { const f = await (await (await (await dir.getDirectoryHandle("pluginConfigs")).getDirectoryHandle("QoLBar")).getFileHandle("iconCache.json")).getFile(); useIconCache(JSON.parse(await f.text()), f.lastModified); return true; } catch { return false; }
}
function pickIconCache(done){
  const pick = h("input", {type: "file", accept: ".json,application/json", hidden: true});
  pick.addEventListener("change", async () => {
    const f = pick.files[0]; pick.remove(); if (!f) return;
    try { useIconCache(JSON.parse(await f.text()), f.lastModified); toast(`Using your icon list: ${ICON_LIST.set.size} icons`); done?.(); } catch (e) { toast(e.message, "err"); }
  });
  document.body.append(pick); pick.click();
}
const iconListText = () => ICON_LIST.source === "yours" ? `your iconCache.json (${iconList().size} icons, ${timeAgo(ICON_LIST.at)})` : `the built-in list (${iconList().size} icons, ${ICON_SNAPSHOT_DATE})`;
// IDs in a range that exist. The Extra range is QoLBar's UI sheets, and those are listed by name.
function rangeIds(a, b){
  if (a >= SHEET_BASE) return Object.keys(ULD_SHEETS).map(n => SHEET_BASE + +n).filter(id => id >= a && id < b);
  const set = iconList(), out = [];
  for (let i = a; i < b; i++) if (set.has(i)) out.push(i);
  return out;
}
function iconTabFor(id){
  for (const [tab, ranges] of ICON_TABS) for (const [a, b, name] of ranges) if (id >= a && id < b) return name ? `${tab} › ${name}` : tab;
  return null;
}
// Loads tile images a few at a time, in screen order, skipping tiles that scrolled away before their turn.
// (An icon xivapi hasn't converted before takes about half a second; after that it's cached for everyone.)
const ICON_Q = {queue: [], busy: 0, max: 8};
// (the pump waits a tick: tiles are queued before they're put on the page)
function queueIcon(img, id){ ICON_Q.queue.push([img, id]); if (!ICON_Q.t) ICON_Q.t = setTimeout(() => { ICON_Q.t = 0; pumpIcons(); }, 0); }
function pumpIcons(){
  while (ICON_Q.busy < ICON_Q.max && ICON_Q.queue.length) {
    const [img, id] = ICON_Q.queue.shift();
    if (!img.isConnected) continue;
    const urls = id < 0 ? [CUSTOM_ICONS.get(-id)].filter(Boolean) : iconUrls(id, false); let at = 0;
    if (!urls.length) { img.parentElement?.classList.add("bad"); continue; }
    ICON_Q.busy++;
    const done = () => { ICON_Q.busy--; pumpIcons(); };
    img.onload = () => { img.parentElement?.classList.add("ok"); ICON_STATS.ok.add(id); done(); };
    img.onerror = () => { if (++at < urls.length) img.src = urls[at]; else { img.parentElement?.classList.add("bad"); done(); } };
    img.src = urls[0];
  }
}
// Search xivapi's game data by name: emotes, actions, items, statuses... and mounts, minions, accessories
const NAME_SHEETS = {Name: ["Emote", "Action", "GeneralAction", "MainCommand", "Status", "Trait", "Item", "PetAction", "CraftAction"], Singular: ["Mount", "Companion", "Ornament"]};
const SHEET_LABEL = {GeneralAction: "General action", MainCommand: "Menu", PetAction: "Pet action", CraftAction: "Crafting action", Companion: "Minion", Ornament: "Accessory"};
async function searchIconsByName(q){
  const esc = q.replace(/"/g, "");
  const one = async (field, sheets) => {
    const r = await fetch(`https://v2.xivapi.com/api/search?sheets=${sheets.join(",")}&query=${encodeURIComponent(`${field}~"${esc}"`)}&fields=${field},Icon&limit=60`);
    if (!r.ok) throw new Error("xivapi answered " + r.status);
    return ((await r.json()).results || []).map(x => ({id: x.fields.Icon?.id, name: x.fields[field], sheet: SHEET_LABEL[x.sheet] || x.sheet, score: x.score}));
  };
  const all = (await Promise.all(Object.entries(NAME_SHEETS).map(([f, s]) => one(f, s)))).flat().filter(x => x.id > 0);
  const seen = new Map();
  for (const x of all.sort((a, b) => b.score - a.score)) if (!seen.has(x.id)) seen.set(x.id, {...x, name: x.name.replace(/^./, c => c.toUpperCase())});
  return [...seen.values()];
}

/* The picker. Resolves to {icon, crop: {iZ, iO} | null} or null. */
const PICKER = {tab: 0, section: -1};
function iconPicker({sh, current}){
  return new Promise(resolve => {
    let chosen = current || null, chosenName = "", result = null;
    const tabsEl = h("div", {class: "ip-tabs"}), chips = h("div", {class: "ip-chips"}), gridBox = h("div", {class: "ip-grid"}), inner = h("div", {class: "ip-inner"});
    gridBox.append(inner);
    const foot = h("div", {class: "ip-foot"}), listNote = h("div", {class: "help", style: {marginTop: 0}});
    const search = h("input", {class: "txt", placeholder: "Search by name (e.g. dance, chocobo, sprint) or type an icon number"});
    let ids = [], names = null, mode = "tab"; // mode: tab | search | advanced
    const TILE = 44, GAP = 4;
    const paintFoot = () => {
      const p = {icon: chosen, args: parseName(sh?.n || "").args || "", hasIcon: true};
      const where = chosen ? (chosen < 0 ? "Custom icon" : chosen >= SHEET_BASE ? `UI sheet: ${ULD_SHEETS[chosen - SHEET_BASE] || "unknown"}` : iconTabFor(chosen)) : "";
      foot.replaceChildren(...[
        chosen ? gIcon({cl: 4294967295, iZ: 1, iO: [0, 0], iR: 0}, p, 52, -1) : h("div", {class: "ip-empty"}),
        h("div", {style: {minWidth: 0, flex: 1}},
          h("div", {style: {fontWeight: 600}}, chosen ? (chosenName || `Icon ${chosen}`) : "Nothing picked yet"),
          h("div", {class: "dim", style: {fontSize: "12.5px"}}, chosen ? [h("span", {class: "mono"}, String(chosen)), where ? "  ·  " + where : ""] : "Click an icon, or double-click to use it straight away."),
          chosen >= SHEET_BASE ? h("div", {class: "help", style: {marginTop: "2px"}}, "A whole interface sheet. Use Advanced to crop one symbol out of it.") : null),
        chosen >= SHEET_BASE ? h("button", {class: "btn sm", onclick: () => { adv.id = chosen; setMode("advanced"); }}, "Crop in Advanced") : null].filter(Boolean));
    };
    const tile = id => {
      const img = h("img", {alt: ""});
      const t = h("button", {type: "button", class: "ip-tile" + (id === chosen ? " sel" : "") + (id === current ? " cur" : ""), tip: `${id}${id === current ? " (current)" : ""}`, onclick: () => { chosen = id; chosenName = names?.get(id) || ""; inner.querySelectorAll(".ip-tile.sel").forEach(e => e.classList.remove("sel")); t.classList.add("sel"); paintFoot(); }, ondblclick: () => { chosen = id; finish(); }}, img);
      if (id >= SHEET_BASE) t.classList.add("sheet");
      queueIcon(img, id);
      return t;
    };
    // Virtual grid: only the rows in view exist
    let cols = 1, lastKey = "";
    const layout = () => {
      if (mode !== "tab") return;
      cols = Math.max(1, Math.floor((gridBox.clientWidth - 12 + GAP) / (TILE + GAP)));
      const rows = Math.ceil(ids.length / cols), rowH = TILE + GAP;
      inner.style.height = rows * rowH + "px";
      const first = Math.max(0, Math.floor(gridBox.scrollTop / rowH) - 2), last = Math.min(rows, Math.ceil((gridBox.scrollTop + gridBox.clientHeight) / rowH) + 2);
      const key = `${first}:${last}:${cols}:${ids.length}:${chosen}`;
      if (key === lastKey) return; lastKey = key;
      const frag = [];
      for (let r = first; r < last; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c; if (i >= ids.length) break;
        const t = tile(ids[i]); t.style.left = 6 + c * (TILE + GAP) + "px"; t.style.top = r * rowH + "px"; frag.push(t);
      }
      inner.replaceChildren(...frag);
    };
    gridBox.addEventListener("scroll", () => requestAnimationFrame(layout));
    const ro = new ResizeObserver(() => { lastKey = ""; layout(); }); ro.observe(gridBox);
    const showIds = list => { ids = list; lastKey = ""; gridBox.scrollTop = 0; inner.classList.remove("list"); layout(); if (!list.length) inner.replaceChildren(h("div", {class: "ip-note"}, "No icons here.")); };
    const openTab = (ti, si = -1) => {
      PICKER.tab = ti; PICKER.section = si; names = null;
      const [name, ranges] = ti === "custom" ? ["Custom", null] : ICON_TABS[ti];
      if (ti === "custom") {
        chips.replaceChildren(h("span", {class: "dim", style: {fontSize: "12.5px"}}, CUSTOM_ICONS.size ? `${CUSTOM_ICONS.size} images from pluginConfigs\\QoLBar\\icons` : "No custom icons loaded."), h("button", {class: "btn sm", onclick: () => pickCustomIcons(true)}, "Load folder..."));
        showIds([...CUSTOM_ICONS.keys()].sort((a, b) => a - b).map(n => -n));
      } else {
        const named = ranges.map((r, i) => [r, i]).filter(([r]) => r[2]);
        chips.replaceChildren(...(named.length > 1 ? [h("button", {class: "ip-chip" + (si < 0 ? " on" : ""), onclick: () => openTab(ti, -1)}, "All"), ...named.map(([r, i]) => h("button", {class: "ip-chip" + (si === i ? " on" : ""), onclick: () => openTab(ti, i)}, r[2]))] : []));
        showIds((si >= 0 ? [ranges[si]] : ranges).flatMap(([a, b]) => rangeIds(a, b)));
      }
      paintTabs();
    };
    const paintTabs = () => tabsEl.replaceChildren(
      ...ICON_TABS.map(([name], i) => h("button", {class: "ip-tab" + (mode === "tab" && PICKER.tab === i ? " on" : ""), onclick: () => { search.value = ""; setMode("tab"); openTab(i); }}, name)),
      h("button", {class: "ip-tab" + (mode === "tab" && PICKER.tab === "custom" ? " on" : ""), onclick: () => { search.value = ""; setMode("tab"); openTab("custom"); }}, "Custom"),
      h("button", {class: "ip-tab adv" + (mode === "advanced" ? " on" : ""), onclick: () => { if (chosen >= SHEET_BASE || !adv.id) adv.id = chosen || adv.id; setMode("advanced"); }}, "Advanced"));
    // Search: a number jumps to that icon, words search the game data by name
    let searchT = 0, searchGen = 0;
    const runSearch = async () => {
      const q = search.value.trim();
      if (!q) { setMode("tab"); openTab(PICKER.tab === "custom" ? "custom" : PICKER.tab, PICKER.section); return; }
      setMode("search");
      const gen = ++searchGen;
      if (/^-?\d+$/.test(q)) {
        const id = +q, known = id < 0 ? CUSTOM_ICONS.has(-id) : id >= SHEET_BASE ? !!ULD_SHEETS[id - SHEET_BASE] : iconList().has(id);
        chips.replaceChildren(h("span", {class: "dim", style: {fontSize: "12.5px"}}, known ? `Icon ${id}${iconTabFor(id) ? ", in " + iconTabFor(id) : ""}` : `Icon ${id} isn't in ${id < 0 ? "your custom icons" : iconListText()}. It may still load; if it doesn't, it doesn't exist.`));
        names = null; inner.classList.remove("list"); inner.style.height = "auto"; inner.replaceChildren(Object.assign(tile(id), {style: "position:relative"}));
        return;
      }
      if (q.length < 2) return;
      chips.replaceChildren(h("span", {class: "dim", style: {fontSize: "12.5px"}}, `Searching the game data for "${q}"...`));
      try {
        const res = await searchIconsByName(q);
        if (gen !== searchGen) return;
        names = new Map(res.map(r => [r.id, r.name]));
        chips.replaceChildren(h("span", {class: "dim", style: {fontSize: "12.5px"}}, res.length ? `${res.length} icons for "${q}", from emotes, actions, items, statuses, mounts, minions and accessories (via xivapi).` : `Nothing named "${q}". Try another word, or browse the tabs.`));
        inner.classList.add("list"); inner.style.height = "auto";
        inner.replaceChildren(...res.map(r => { const t = tile(r.id); t.style.position = "relative"; return h("div", {class: "ip-hit" + (r.id === chosen ? " sel" : ""), onclick: e => { if (e.target === t || t.contains(e.target)) return; t.click(); }, ondblclick: () => { chosen = r.id; finish(); }}, t, h("div", {style: {minWidth: 0}}, h("div", {class: "ip-hit-name"}, r.name), h("div", {class: "faint", style: {fontSize: "11.5px"}}, `${r.sheet} · ${r.id}`))); }));
      } catch (e) { if (gen === searchGen) chips.replaceChildren(h("span", {style: {color: "var(--red)", fontSize: "12.5px"}}, `Search failed (${e.message}). Check your connection.`)); }
    };
    search.addEventListener("input", () => { clearTimeout(searchT); searchT = setTimeout(runSearch, 350); });
    search.addEventListener("keydown", e => { if (e.key === "Enter") { clearTimeout(searchT); runSearch(); } });

    /* Advanced: crop part of a texture (usually a UI sheet) with a draggable square. QoLBar shows 1/zoom of the
       texture around (0.5 + offset), so zoom = 1 / box size and offset = box center - 0.5 (texture padded square). */
    const adv = {id: sh && parseName(sh.n).icon >= SHEET_BASE ? parseName(sh.n).icon : null, size: sh && Math.abs(sh.iZ) > 1 ? 1 / Math.abs(sh.iZ) : .25, cx: sh ? .5 + sh.iO[0] : .5, cy: sh ? .5 + sh.iO[1] : .5};
    const advBox = h("div", {class: "ip-adv"});
    const paintAdv = () => {
      const opts = [...Object.entries(ULD_SHEETS).map(([n, name]) => ({value: SHEET_BASE + +n, label: name, hint: String(SHEET_BASE + +n), search: String(SHEET_BASE + +n)}))];
      if (adv.id && adv.id < SHEET_BASE) opts.unshift({value: adv.id, label: `Icon ${adv.id}`, hint: "regular icon"});
      const stage = h("div", {class: "ip-stage"}), img = h("img", {alt: ""}), crop = h("div", {class: "ip-crop"}, h("span", {class: "ip-handle"}));
      stage.append(img, crop);
      const S0 = 380;
      if (adv.id) { const urls = adv.id < 0 ? [CUSTOM_ICONS.get(-adv.id)] : iconUrls(adv.id, true); let at = 0; img.onerror = () => { if (++at < urls.length) img.src = urls[at]; }; img.src = urls[0]; }
      const out = h("div", {class: "ip-adv-side"});
      const clamp = () => { adv.size = Math.min(1, Math.max(.02, adv.size)); adv.cx = Math.min(1 - adv.size / 2, Math.max(adv.size / 2, adv.cx)); adv.cy = Math.min(1 - adv.size / 2, Math.max(adv.size / 2, adv.cy)); };
      const crop2 = () => ({iZ: shortestF32(1 / adv.size), iO: [shortestF32(adv.cx - .5), shortestF32(adv.cy - .5)]});
      const place = () => {
        clamp();
        Object.assign(crop.style, {left: (adv.cx - adv.size / 2) * S0 + "px", top: (adv.cy - adv.size / 2) * S0 + "px", width: adv.size * S0 + "px", height: adv.size * S0 + "px"});
        const c = crop2(), fake = {cl: 4294967295, iZ: c.iZ, iO: c.iO, iR: sh?.iR || 0}, p = {icon: adv.id, args: parseName(sh?.n || "").args || "", hasIcon: true};
        out.replaceChildren(
          h("div", {class: "flabel"}, "Result"),
          h("div", {class: "inline", style: {gap: "12px", alignItems: "flex-end"}}, adv.id ? gIcon(fake, p, 64, -1) : null, adv.id ? gIcon(fake, p, 32, -1) : null),
          h("div", {class: "grid", style: {gridTemplateColumns: "70px 1fr", gap: "8px 10px", marginTop: "12px"}},
            h("label", {class: "flabel"}, "Zoom"), numInput(c.iZ, v => { adv.size = 1 / Math.max(1, v); place(); }, {float: true, step: .1, min: 1, width: "90px", noUndo: true}),
            h("label", {class: "flabel"}, "Offset x"), numInput(c.iO[0], v => { adv.cx = .5 + v; place(); }, {float: true, step: .005, width: "90px", noUndo: true}),
            h("label", {class: "flabel"}, "Offset y"), numInput(c.iO[1], v => { adv.cy = .5 + v; place(); }, {float: true, step: .005, width: "90px", noUndo: true})),
          h("div", {class: "help"}, "Drag the square to move it, drag its corner or scroll to resize. These become the shortcut's icon zoom and offset, exactly as QoLBar uses them."),
          h("button", {class: "btn primary", style: {marginTop: "12px"}, disabled: !adv.id, onclick: () => { chosen = adv.id; result = {icon: adv.id, crop: crop2()}; close(); }}, "Use this crop"));
      };
      // Dragging and resizing (the square stays square)
      crop.addEventListener("pointerdown", e => {
        e.preventDefault(); crop.setPointerCapture(e.pointerId);
        const resize = e.target.classList.contains("ip-handle"), sx = e.clientX, sy = e.clientY, s0 = {...adv};
        const move = ev => { const dx = (ev.clientX - sx) / S0, dy = (ev.clientY - sy) / S0; if (resize) { const d = Math.max(dx, dy); adv.size = s0.size + d; adv.cx = s0.cx - s0.size / 2 + adv.size / 2; adv.cy = s0.cy - s0.size / 2 + adv.size / 2; } else { adv.cx = s0.cx + dx; adv.cy = s0.cy + dy; } place(); };
        const up = () => { crop.removeEventListener("pointermove", move); crop.removeEventListener("pointerup", up); };
        crop.addEventListener("pointermove", move); crop.addEventListener("pointerup", up);
      });
      stage.addEventListener("wheel", e => { e.preventDefault(); adv.size *= e.deltaY > 0 ? 1.08 : 1 / 1.08; place(); }, {passive: false});
      // Click somewhere on the sheet to center the square there
      stage.addEventListener("pointerdown", e => { if (e.target !== stage && e.target !== img) return; const r = stage.getBoundingClientRect(); adv.cx = (e.clientX - r.left) / S0; adv.cy = (e.clientY - r.top) / S0; place(); });
      advBox.replaceChildren(
        h("div", {class: "inline", style: {marginBottom: "10px"}}, h("span", {class: "dim"}, "Crop from"), dropdown({value: adv.id, width: "300px", searchable: true, placeholder: "Pick a UI sheet...", options: opts, onChange: v => { adv.id = v; adv.size = .25; adv.cx = adv.cy = .5; paintAdv(); }}),
          h("span", {class: "help", style: {marginTop: 0}}, "Game interface sheets (and any icon you picked) can be cropped to one symbol.")),
        h("div", {class: "inline", style: {alignItems: "flex-start", gap: "20px", flexWrap: "nowrap"}}, adv.id ? stage : h("div", {class: "ip-stage empty"}, "Pick a sheet to crop"), out));
      place();
    };
    const setMode = m => {
      mode = m;
      gridBox.style.display = m === "advanced" ? "none" : ""; advBox.style.display = m === "advanced" ? "" : "none"; chips.style.display = m === "advanced" ? "none" : "";
      if (m === "advanced") { search.value = ""; paintAdv(); }
      paintTabs();
    };
    const close = () => { ro.disconnect(); ICON_Q.queue.length = 0; scrim.remove(); document.removeEventListener("keydown", esc, true); resolve(result); };
    const finish = () => { if (!chosen) return; result = {icon: chosen, crop: null}; close(); };
    const esc = e => { if (e.key === "Escape" && !POP) { e.stopPropagation(); close(); } };
    const modalEl = h("div", {class: "modal ip"},
      h("div", {class: "m-hd"}, "Pick an icon"),
      h("div", {class: "m-bd", style: {display: "flex", flexDirection: "column", gap: "10px", overflow: "hidden"}}, search, tabsEl, chips, gridBox, advBox, listNote),
      h("div", {class: "m-ft", style: {alignItems: "center"}}, foot, h("button", {class: "btn", onclick: close}, "Cancel"), h("button", {class: "btn primary", onclick: finish}, "Use icon")));
    const scrim = h("div", {class: "scrim", onmousedown: e => { if (e.target === scrim) close(); }}, modalEl);
    const paintNote = () => listNote.replaceChildren("Icons that exist come from ", iconListText(), ". ",
      ICON_LIST.source === "yours" ? "" : h("a", {class: "link", onclick: () => pickIconCache(() => { paintNote(); openTab(PICKER.tab, PICKER.section); })}, "Load your iconCache.json"), ICON_LIST.source === "yours" ? "" : " for your exact game version. ",
      "Images come from xivapi.", ICON_LIST.source === "yours" ? "" : pathLine(PATH.iconCache));
    paintNote();
    (document.fullscreenElement || document.body).append(scrim);
    document.addEventListener("keydown", esc, true);
    // Start where the current icon lives
    if (current && current >= SHEET_BASE && sh && (sh.iZ !== 1 || sh.iO[0] || sh.iO[1])) setMode("advanced");
    else {
      let ti = PICKER.tab, si = -1;
      if (current) { const hit = ICON_TABS.findIndex(([, rs]) => rs.some(([a, b]) => current >= a && current < b)); if (hit >= 0) ti = hit; if (current < 0) ti = "custom"; }
      setMode("tab"); openTab(ti, si);
      if (current) requestAnimationFrame(() => { const i = ids.indexOf(current); if (i >= 0) { gridBox.scrollTop = Math.floor(i / cols) * (TILE + GAP) - 60; layout(); } });
    }
    paintFoot();
    setTimeout(() => search.focus(), 30);
  });
}
// Opens the picker for a shortcut and applies the result as one undo step
async function browseIcon(sh, after){
  const p = parseName(sh.n);
  const r = await iconPicker({sh, current: p.hasIcon ? p.icon : null});
  if (!r) return;
  commit();
  const q = parseName(sh.n), wasSheet = q.icon >= SHEET_BASE;
  q.hasIcon = true; q.icon = r.icon; q.iconRaw = String(r.icon);
  sh.n = buildName(q);
  if (r.crop) { sh.iZ = r.crop.iZ; sh.iO = r.crop.iO; }
  else if (wasSheet && r.icon < SHEET_BASE) { sh.iZ = 1; sh.iO = [0, 0]; } // a whole regular icon, not a crop of the old sheet
  touch(); after?.();
}
