'use strict';

let scalingList = {
  decode: function (readType, output, index) {
    let lastScale = 8;
    let nextScale = 8;
    let deltaScale;
    let count = 16;
    let scalingArr = [];

    if (!Array.isArray(output.scalingList)) {
      output.scalingList = [];
    }

    if (index >= 6) {
      count = 64;
    }

    for (let j = 0; j < count; j++) {
      if (nextScale !== 0) {
        deltaScale = readType.se();
        nextScale = (lastScale + deltaScale + 256) % 256;
      }

      lastScale = (nextScale === 0) ? lastScale : nextScale;
      scalingArr.push(lastScale);
    }

    output.scalingList[index] = scalingArr;

    return output;
  },
  encode: function (writeType, input, index) {
    let lastScale = 8;
    let nextScale = 8;
    let deltaScale;
    let count = 16;
    let output = '';

    if (!Array.isArray(input.scalingList)) {
      return '';
    }

    if (index >= 6) {
      count = 64;
    }

    let scalingArr = output.scalingList[index];

    for (let j = 0; j < count; j++) {
      if (scalingArr[j] === lastScale) {
        output += writeType.se(-lastScale);
        break;
      }
      nextScale = scalingArr[j] - lastScale;
      output += writeType.se(nextScale);
      lastScale = scalingArr[j];
    }
    return output;
  }
};

module.exports = scalingList
