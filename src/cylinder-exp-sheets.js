import standradXls from "../experiments/official-standrad-readable-row-schedule/exp-readable-map.xls?url";
import standradTxt from "../experiments/official-standrad-readable-row-schedule/exp-readable-map.txt?url";
import standradChrome from "../experiments/official-standrad-readable-row-schedule/preview-chrome.json";
import standradKnit from "../experiments/official-standrad-readable-row-schedule/exp-knitcode.json?url";
import denseStandradXls from "../experiments/official-dense-standrad-readable-row-schedule/exp-readable-map.xls?url";
import denseStandradTxt from "../experiments/official-dense-standrad-readable-row-schedule/exp-readable-map.txt?url";
import denseStandradChrome from "../experiments/official-dense-standrad-readable-row-schedule/preview-chrome.json";
import denseStandradKnit from "../experiments/official-dense-standrad-readable-row-schedule/exp-knitcode.json?url";
import increaseXls from "../experiments/official-increase-readable-row-schedule/exp-readable-map.xls?url";
import increaseTxt from "../experiments/official-increase-readable-row-schedule/exp-readable-map.txt?url";
import increaseChrome from "../experiments/official-increase-readable-row-schedule/preview-chrome.json";
import increaseKnit from "../experiments/official-increase-readable-row-schedule/exp-knitcode.json?url";
import decreaseXls from "../experiments/official-decrease-readable-row-schedule/exp-readable-map.xls?url";
import decreaseTxt from "../experiments/official-decrease-readable-row-schedule/exp-readable-map.txt?url";
import decreaseChrome from "../experiments/official-decrease-readable-row-schedule/preview-chrome.json";
import decreaseKnit from "../experiments/official-decrease-readable-row-schedule/exp-knitcode.json?url";
import thinXls from "../experiments/official-thin-readable-row-schedule/exp-readable-map.xls?url";
import thinTxt from "../experiments/official-thin-readable-row-schedule/exp-readable-map.txt?url";
import thinChrome from "../experiments/official-thin-readable-row-schedule/preview-chrome.json";
import thinKnit from "../experiments/official-thin-readable-row-schedule/exp-knitcode.json?url";
import fatXls from "../experiments/official-fat-readable-row-schedule/exp-readable-map.xls?url";
import fatTxt from "../experiments/official-fat-readable-row-schedule/exp-readable-map.txt?url";
import fatChrome from "../experiments/official-fat-readable-row-schedule/preview-chrome.json";
import fatKnit from "../experiments/official-fat-readable-row-schedule/exp-knitcode.json?url";
import denseIncreaseXls from "../experiments/official-dense-increase-readable-row-schedule/exp-readable-map.xls?url";
import denseIncreaseTxt from "../experiments/official-dense-increase-readable-row-schedule/exp-readable-map.txt?url";
import denseIncreaseChrome from "../experiments/official-dense-increase-readable-row-schedule/preview-chrome.json";
import denseIncreaseKnit from "../experiments/official-dense-increase-readable-row-schedule/exp-knitcode.json?url";
import denseDecreaseXls from "../experiments/official-dense-decrease-readable-row-schedule/exp-readable-map.xls?url";
import denseDecreaseTxt from "../experiments/official-dense-decrease-readable-row-schedule/exp-readable-map.txt?url";
import denseDecreaseChrome from "../experiments/official-dense-decrease-readable-row-schedule/preview-chrome.json";
import denseDecreaseKnit from "../experiments/official-dense-decrease-readable-row-schedule/exp-knitcode.json?url";
import denseThinXls from "../experiments/official-dense-thin-readable-row-schedule/exp-readable-map.xls?url";
import denseThinTxt from "../experiments/official-dense-thin-readable-row-schedule/exp-readable-map.txt?url";
import denseThinChrome from "../experiments/official-dense-thin-readable-row-schedule/preview-chrome.json";
import denseThinKnit from "../experiments/official-dense-thin-readable-row-schedule/exp-knitcode.json?url";
import denseFatXls from "../experiments/official-dense-fat-readable-row-schedule/exp-readable-map.xls?url";
import denseFatTxt from "../experiments/official-dense-fat-readable-row-schedule/exp-readable-map.txt?url";
import denseFatChrome from "../experiments/official-dense-fat-readable-row-schedule/preview-chrome.json";
import denseFatKnit from "../experiments/official-dense-fat-readable-row-schedule/exp-knitcode.json?url";

/** Official-cylinder timing experiments. Bunny stays on its own sheet. */
export const CYLINDER_EXP_SHEETS = [
  {
    sheetId: "standrad-exp-readable-row-schedule",
    buttonId: "load-standrad-exp-readable-row-schedule",
    manifest: "standrad-cylinder.json",
    officialName: "Standrad Cylinder",
    directory: "experiments/official-standrad-readable-row-schedule",
    xlsUrl: standradXls,
    txtUrl: standradTxt,
    knitUrl: standradKnit,
    chrome: standradChrome,
  },
  {
    sheetId: "dense-standrad-exp-readable-row-schedule",
    buttonId: "load-dense-standrad-exp-readable-row-schedule",
    manifest: "dense-standrad-cylinder.json",
    officialName: "Dense Standrad Cylinder",
    directory: "experiments/official-dense-standrad-readable-row-schedule",
    xlsUrl: denseStandradXls,
    txtUrl: denseStandradTxt,
    knitUrl: denseStandradKnit,
    chrome: denseStandradChrome,
  },
  {
    sheetId: "increase-exp-readable-row-schedule",
    buttonId: "load-increase-exp-readable-row-schedule",
    manifest: "increase-cylinder.json",
    officialName: "Increase Cylinder",
    directory: "experiments/official-increase-readable-row-schedule",
    xlsUrl: increaseXls,
    txtUrl: increaseTxt,
    knitUrl: increaseKnit,
    chrome: increaseChrome,
  },
  {
    sheetId: "decrease-exp-readable-row-schedule",
    buttonId: "load-decrease-exp-readable-row-schedule",
    manifest: "decrease-cylinder.json",
    officialName: "Decrease Cylinder",
    directory: "experiments/official-decrease-readable-row-schedule",
    xlsUrl: decreaseXls,
    txtUrl: decreaseTxt,
    knitUrl: decreaseKnit,
    chrome: decreaseChrome,
  },
  {
    sheetId: "thin-exp-readable-row-schedule",
    buttonId: "load-thin-exp-readable-row-schedule",
    manifest: "thin-cylinder.json",
    officialName: "Thin Cylinder",
    directory: "experiments/official-thin-readable-row-schedule",
    xlsUrl: thinXls,
    txtUrl: thinTxt,
    knitUrl: thinKnit,
    chrome: thinChrome,
  },
  {
    sheetId: "fat-exp-readable-row-schedule",
    buttonId: "load-fat-exp-readable-row-schedule",
    manifest: "fat-cylinder.json",
    officialName: "Fat Cylinder",
    directory: "experiments/official-fat-readable-row-schedule",
    xlsUrl: fatXls,
    txtUrl: fatTxt,
    knitUrl: fatKnit,
    chrome: fatChrome,
  },
  {
    sheetId: "dense-increase-exp-readable-row-schedule",
    buttonId: "load-dense-increase-exp-readable-row-schedule",
    manifest: "dense-increase-cylinder.json",
    officialName: "Dense Increase Cylinder",
    directory: "experiments/official-dense-increase-readable-row-schedule",
    xlsUrl: denseIncreaseXls,
    txtUrl: denseIncreaseTxt,
    knitUrl: denseIncreaseKnit,
    chrome: denseIncreaseChrome,
  },
  {
    sheetId: "dense-decrease-exp-readable-row-schedule",
    buttonId: "load-dense-decrease-exp-readable-row-schedule",
    manifest: "dense-decrease-cylinder.json",
    officialName: "Dense Decrease Cylinder",
    directory: "experiments/official-dense-decrease-readable-row-schedule",
    xlsUrl: denseDecreaseXls,
    txtUrl: denseDecreaseTxt,
    knitUrl: denseDecreaseKnit,
    chrome: denseDecreaseChrome,
  },
  {
    sheetId: "dense-thin-exp-readable-row-schedule",
    buttonId: "load-dense-thin-exp-readable-row-schedule",
    manifest: "dense-thin-cylinder.json",
    officialName: "Dense Thin Cylinder",
    directory: "experiments/official-dense-thin-readable-row-schedule",
    xlsUrl: denseThinXls,
    txtUrl: denseThinTxt,
    knitUrl: denseThinKnit,
    chrome: denseThinChrome,
  },
  {
    sheetId: "dense-fat-exp-readable-row-schedule",
    buttonId: "load-dense-fat-exp-readable-row-schedule",
    manifest: "dense-fat-cylinder.json",
    officialName: "Dense Fat Cylinder",
    directory: "experiments/official-dense-fat-readable-row-schedule",
    xlsUrl: denseFatXls,
    txtUrl: denseFatTxt,
    knitUrl: denseFatKnit,
    chrome: denseFatChrome,
  },
];

export function cylinderExpBySheet(sheet) {
  const want = String(sheet || "").trim().toLowerCase();
  return CYLINDER_EXP_SHEETS.find((item) => item.sheetId === want) || null;
}
