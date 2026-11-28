import expReadableMapUrl from "../experiments/official-bunny-readable-row-schedule/exp-readable-map.xls?url";
import expReadableMapTxtUrl from "../experiments/official-bunny-readable-row-schedule/exp-readable-map.txt?url";
import expKnitUrl from "../experiments/official-bunny-readable-row-schedule/exp-knitcode.json?url";
import standradXls from "../experiments/official-standrad-readable-row-schedule/exp-readable-map.xls?url";
import standradTxt from "../experiments/official-standrad-readable-row-schedule/exp-readable-map.txt?url";
import standradKnit from "../experiments/official-standrad-readable-row-schedule/exp-knitcode.json?url";
import denseStandradXls from "../experiments/official-dense-standrad-readable-row-schedule/exp-readable-map.xls?url";
import denseStandradTxt from "../experiments/official-dense-standrad-readable-row-schedule/exp-readable-map.txt?url";
import denseStandradKnit from "../experiments/official-dense-standrad-readable-row-schedule/exp-knitcode.json?url";
import increaseXls from "../experiments/official-increase-readable-row-schedule/exp-readable-map.xls?url";
import increaseTxt from "../experiments/official-increase-readable-row-schedule/exp-readable-map.txt?url";
import increaseKnit from "../experiments/official-increase-readable-row-schedule/exp-knitcode.json?url";
import decreaseXls from "../experiments/official-decrease-readable-row-schedule/exp-readable-map.xls?url";
import decreaseTxt from "../experiments/official-decrease-readable-row-schedule/exp-readable-map.txt?url";
import decreaseKnit from "../experiments/official-decrease-readable-row-schedule/exp-knitcode.json?url";
import thinXls from "../experiments/official-thin-readable-row-schedule/exp-readable-map.xls?url";
import thinTxt from "../experiments/official-thin-readable-row-schedule/exp-readable-map.txt?url";
import thinKnit from "../experiments/official-thin-readable-row-schedule/exp-knitcode.json?url";
import fatXls from "../experiments/official-fat-readable-row-schedule/exp-readable-map.xls?url";
import fatTxt from "../experiments/official-fat-readable-row-schedule/exp-readable-map.txt?url";
import fatKnit from "../experiments/official-fat-readable-row-schedule/exp-knitcode.json?url";
import denseIncreaseXls from "../experiments/official-dense-increase-readable-row-schedule/exp-readable-map.xls?url";
import denseIncreaseTxt from "../experiments/official-dense-increase-readable-row-schedule/exp-readable-map.txt?url";
import denseIncreaseKnit from "../experiments/official-dense-increase-readable-row-schedule/exp-knitcode.json?url";
import denseDecreaseXls from "../experiments/official-dense-decrease-readable-row-schedule/exp-readable-map.xls?url";
import denseDecreaseTxt from "../experiments/official-dense-decrease-readable-row-schedule/exp-readable-map.txt?url";
import denseDecreaseKnit from "../experiments/official-dense-decrease-readable-row-schedule/exp-knitcode.json?url";
import denseThinXls from "../experiments/official-dense-thin-readable-row-schedule/exp-readable-map.xls?url";
import denseThinTxt from "../experiments/official-dense-thin-readable-row-schedule/exp-readable-map.txt?url";
import denseThinKnit from "../experiments/official-dense-thin-readable-row-schedule/exp-knitcode.json?url";
import denseFatXls from "../experiments/official-dense-fat-readable-row-schedule/exp-readable-map.xls?url";
import denseFatTxt from "../experiments/official-dense-fat-readable-row-schedule/exp-readable-map.txt?url";
import denseFatKnit from "../experiments/official-dense-fat-readable-row-schedule/exp-knitcode.json?url";

/** Reviewed new-schedule tables. Official sheets point here; the matrices are not copied. */
export const NEW_SCHEDULE_ASSETS = {
  "faces-ring0": { xlsUrl: expReadableMapUrl, txtUrl: expReadableMapTxtUrl, knitUrl: expKnitUrl },
  "standrad-cylinder": { xlsUrl: standradXls, txtUrl: standradTxt, knitUrl: standradKnit },
  "dense-standrad-cylinder": { xlsUrl: denseStandradXls, txtUrl: denseStandradTxt, knitUrl: denseStandradKnit },
  "increase-cylinder": { xlsUrl: increaseXls, txtUrl: increaseTxt, knitUrl: increaseKnit },
  "decrease-cylinder": { xlsUrl: decreaseXls, txtUrl: decreaseTxt, knitUrl: decreaseKnit },
  "thin-cylinder": { xlsUrl: thinXls, txtUrl: thinTxt, knitUrl: thinKnit },
  "fat-cylinder": { xlsUrl: fatXls, txtUrl: fatTxt, knitUrl: fatKnit },
  "dense-increase-cylinder": { xlsUrl: denseIncreaseXls, txtUrl: denseIncreaseTxt, knitUrl: denseIncreaseKnit },
  "dense-decrease-cylinder": { xlsUrl: denseDecreaseXls, txtUrl: denseDecreaseTxt, knitUrl: denseDecreaseKnit },
  "dense-thin-cylinder": { xlsUrl: denseThinXls, txtUrl: denseThinTxt, knitUrl: denseThinKnit },
  "dense-fat-cylinder": { xlsUrl: denseFatXls, txtUrl: denseFatTxt, knitUrl: denseFatKnit },
};
