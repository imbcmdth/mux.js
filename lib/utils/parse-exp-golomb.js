'use strict';

let ExpGolombString = require('./make-exp-golomb');
let ExpGolomb = require('./exp-golomb');

/**
 * General ExpGolomb-Encoded-Structure Parse Functions
 */
let start = function (parseFn) {
  return {
    decode: (input, output) => {
      let expGolombDecoder = new ExpGolomb(input);
      let readType = {
        b: () => expGolombDecoder.readUnsignedByte(),
        f: (n) => expGolombDecoder.readBits(n),
        /*
        i: (n) => {
          let v = expGolombDecoder.readBits(n);
          let signPos = n - 1;
          let sign = (v & (1 << signPos)) >> signPos;
          let val = n & (signPos - 1);
          return sign ? -val: val;
        },
        */
        se: () => expGolombDecoder.readExpGolomb(),
        u: (n) => expGolombDecoder.readBits(n),
        ue: () => expGolombDecoder.readUnsignedExpGolomb(),
        expGolomb: expGolombDecoder
      };

      output = output || {};

      return parseFn.decode(readType, output);
    },
    encode: (input) => {
      let writeType = {
        b: (v, s) => ExpGolombString.writeUnsignedByte(v, s),
        f: (n, v, s) => ExpGolombString.writeBits(n, v, s),
        // i: (n, v, s) => {},
        se: (v, s) => ExpGolombString.writeExpGolomb(v, s),
        u: (n, v, s) => ExpGolombString.writeBits(n, v, s),
        ue: (v, s) => ExpGolombString.writeUnsignedExpGolomb(v, s)
      };

      let output = parseFn.encode(writeType, input);

      let bitsNeeded = 8 - (output.length % 8);

      if (bitsNeeded === 0) {
        output += '10000000';
      } else {
        output += '1';
        for (let i = 1; i < bitsNeeded; i++) {
          output += '0';
        }
      }

      let outputArray = output.match(/(.{8})/g);
      let numberArray = outputArray.map((n) => parseInt(n, 2));

      return new Uint8Array(numberArray);
    }
  };
};

let list = function (parseFns) {
  return {
    decode: (readType, output, index) => {
      parseFns.forEach((fn) => {
        output = fn.decode(readType, output, index) || output;
      });

      return output;
    },
    encode: (writeType, input, index) => {
      let output = "";

      parseFns.forEach((fn) => {
        output += fn.encode(writeType, input, index);
        console.log('progress', output);
      });

      return output;
    }
  };
};

let data = function (name, format) {
  let nameMatch = (/([^\[]*)(\[.*\])?/).exec(name);
  let formatMatch = (/(.*)\((.*)\)/i).exec(format);
  let property;
  let nameArray;
  let type;
  let size;

  if (nameMatch && nameMatch.length > 1) {
    property = nameMatch[1];
    nameArray = nameMatch[2] !== undefined;
  } else {
    throw new Error('ExpGolombError: Invalid name "' + format + '".');
  }

  if (formatMatch && formatMatch.length > 2) {
    type = formatMatch[1];
    size = parseFloat(formatMatch[2]);
    if (isNaN(size)) {
      size = formatMatch[2];
    }
  } else {
    throw new Error('ExpGolombError: Invalid format "' + format + '".');
  }

  return {
    decode: (readType, output, index) => {
      let value;

      if (typeof size === 'number') {
        value = readType[type](size);
      } else if (size === 'v') {
        value = readType[type]();
      }

console.log('decoding <<', name, index, value);

      if (!nameArray) {
        output[property] = value;
      } else {
        if (!Array.isArray(output[property])) {
          output[property] = [];
        }

        if (index !== undefined) {
          output[property][index] = value;
        } else {
          output[property].push(value);
        }
      }

      return output;
    },
    encode: (writeType, input, index) => {
      let value;

      if (!nameArray) {
        value = input[property];
      } else if (Array.isArray(output[property])) {
        if (index !== undefined) {
          value = input[property][index];
        } else {
          value = input[property].shift();
        }
      }

      if (typeof value !== 'number') {
        return '';
      }

console.log('encoding >>', name, index, value);

      if (typeof size === 'number') {
        return writeType[type](size, value);
      } else if (size === 'v') {
        return writeType[type](value);
      }

      return '';
    }
  };
};

let when = function (conditionFn, parseFn) {
  return {
    decode: (readType, output, index) => {
      if (conditionFn(output, index)) {
        return parseFn.decode(readType, output, index);
      }

      return output;
    },
    encode: (writeType, input, index) => {
      if (conditionFn(input, index)) {
        return parseFn.encode(writeType, input, index);
      }

      return '';
    }
  };
};

let each = function (conditionFn, parseFn) {
  return {
    decode: (readType, output) => {
      let index = 0;

      while (conditionFn(index, output)) {
        parseFn.decode(readType, output, index);
        index++;
      }

      return output;
    },
    encode: (writeType, input) => {
      let index = 0;
      let output = '';

      while (conditionFn(index, input)) {
        output += parseFn.encode(writeType, input, index);
        index++;
      }

      return output;
    }
  };
};

let inArray = function (name, array) {
  let nameMatch = (/([^\[]*)(\[.*\])?/).exec(name);
  let nameArray = nameMatch[2];
  let property = nameMatch[1];

  return (obj, index) => {
    if (nameArray) {
      return array.indexOf(obj[property][index]) !== -1;
    } else {
      return array.indexOf(obj[property]) !== -1;
    }
  };
};

let equals = function (name, value) {
  let nameMatch = (/([^\[]*)(\[.*\])?/).exec(name);
  let nameArray = nameMatch[2];
  let property = nameMatch[1];

  return (obj, index) => {
    if (nameArray) {
      return obj[property][index] === value;
    } else {
      return obj[property] === value;
    }
  };
};

let not = function (fn) {
  return (obj, index) => {
    return !fn(obj, index);
  };
};

let some = function (conditionFns) {
  return (obj, index) => {
    return conditionFns.some((fn)=>fn(obj, index));
  };
};

let every = function (conditionFns) {
  return (obj, index) => {
    return conditionFns.every((fn)=>fn(obj, index));
  };
};


module.exports = {
  start: start,
  list: list,
  data: data,
  each: each,
  when: when,
  inArray: inArray,
  equals: equals,
  not: not,
  some: some,
  every: every
};
