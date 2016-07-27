'use strict';

let expGolombString = require('./exp-golomb-string');

let getNumBits = (numBits, expGolomb, data, index, options) => {
  if (typeof numBits === 'function') {
    return numBits(expGolomb, data, options, index);
  }
  return numBits;
};

let dataTypes = {
  u: (numBits) => {
    return {
      read: (expGolomb, output, options, index) => {
        let bitsToRead = getNumBits(numBits, expGolomb, output, options, index);

        return expGolomb.readBits(bitsToRead);
      },
      write: (expGolomb, input, options, index, value) => {
        let bitsToWrite = getNumBits(numBits, expGolomb, input, options, index);

        expGolomb.writeBits(value, bitsToWrite);
      }
    };
  },
  f: (numBits) => {
    return {
      read: (expGolomb, output, options, index) => {
        let bitsToRead = getNumBits(numBits, expGolomb, output, options, index);

        return expGolomb.readBits(bitsToRead);
      },
      write: (expGolomb, input, options, index, value) => {
        let bitsToWrite = getNumBits(numBits, expGolomb, input, options, index);

        expGolomb.writeBits(value, bitsToWrite);
      }
    };
  },
  ue: () => {
    return {
      read: (expGolomb, output, options, index) => {
        return expGolomb.readUnsignedExpGolomb();
      },
      write: (expGolomb, input, options, index, value) => {
        expGolomb.writeUnsignedExpGolomb(value);
      }
    };
  },
  se: () => {
    return {
      read: (expGolomb, output, options, index) => {
        return expGolomb.readExpGolomb();
      },
      write: (expGolomb, input, options, index, value) => {
        expGolomb.writeExpGolomb(value);
      }
    };
  },
  b: () => {
    return {
      read: (expGolomb, output, options, index) => {
        return expGolomb.readUnsignedByte();
      },
      write: (expGolomb, input, options, index, value) => {
        expGolomb.writeUnsignedByte(value);
      }
    };
  }
};

/**
 * General ExpGolomb-Encoded-Structure Parse Functions
 */
let start = function (parseFn) {
  return {
    decode: (input, options) => {
      let rawBitString = expGolombString.typedArrayToBitString(input);
      let bitString = expGolombString.removeRBSPTrailingBits(rawBitString);
      let expGolombDecoder = new expGolombString.ExpGolombDecoder(bitString);
      let output = {};

      options = options || {};

      return parseFn.decode(expGolombDecoder, output, options);
    },
    encode: (input, options) => {
      let expGolombEncoder = new expGolombString.ExpGolombEncoder();

      options = options || {};

      parseFn.encode(expGolombEncoder, input, options);

      let output = expGolombEncoder.bitReservoir;
      let bitString = expGolombString.appendRBSPTrailingBits(output);
      let data = expGolombString.bitStringToTypedArray(bitString);

      return data;
    }
  };
};

let list = function (parseFns) {
  return {
    decode: (expGolomb, output, options, index) => {
      parseFns.forEach((fn) => {
        output = fn.decode(expGolomb, output, options, index) || output;
      });

      return output;
    },
    encode: (expGolomb, input, options, index) => {
      parseFns.forEach((fn) => {
        fn.encode(expGolomb, input, options, index);
      });
    }
  };
};

let data = function (name, dataType) {
  let nameMatch = (/([^\[]*)(\[.*\])?/).exec(name);
  let property;
  let nameArray;

  if (nameMatch && nameMatch.length > 1) {
    property = nameMatch[1];
    nameArray = nameMatch[2] !== undefined;
  } else {
    throw new Error('ExpGolombError: Invalid name "' + format + '".');
  }

  return {
    decode: (expGolomb, output, options, index) => {
      let value;

      value = dataType.read(expGolomb, output, options, index);

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
    encode: (expGolomb, input, options, index) => {
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
        return;
      }

      value = dataType.write(expGolomb, input, options, index, value);
    }
  };
};

let when = function (conditionFn, parseFn) {
  return {
    decode: (expGolomb, output, options, index) => {
      if (conditionFn(output, options, index)) {
        return parseFn.decode(expGolomb, output, options, index);
      }

      return output;
    },
    encode: (expGolomb, input, options, index) => {
      if (conditionFn(input, options, index)) {
        parseFn.encode(expGolomb, input, options, index);
      }
    }
  };
};

let each = function (conditionFn, parseFn) {
  return {
    decode: (expGolomb, output, options) => {
      let index = 0;

      while (conditionFn(index, output, options)) {
        parseFn.decode(expGolomb, output, options, index);
        index++;
      }

      return output;
    },
    encode: (expGolomb, input, options) => {
      let index = 0;

      while (conditionFn(index, input, options)) {
        parseFn.encode(expGolomb, input, options, index);
        index++;
      }
    }
  };
};

let inArray = function (name, array) {
  let nameMatch = (/([^\[]*)(\[.*\])?/).exec(name);
  let nameArray = nameMatch[2];
  let property = nameMatch[1];

  return (obj, options, index) => {
    if (nameArray) {
      return (obj[property] && array.indexOf(obj[property][index]) !== -1) ||
        (options[property] && array.indexOf(options[property][index]) !== -1);
    } else {
      return array.indexOf(obj[property]) !== -1 ||
        array.indexOf(options[property]) !== -1;
    }
  };
};

let equals = function (name, value) {
  let nameMatch = (/([^\[]*)(\[.*\])?/).exec(name);
  let nameArray = nameMatch[2];
  let property = nameMatch[1];

  return (obj, options, index) => {
    if (nameArray) {
      return (obj[property] && obj[property][index] === value) ||
        (options[property] && options[property][index] === value);
    } else {
      return obj[property] === value ||
        options[property] === value;
    }
  };
};

let not = function (fn) {
  return (obj, options, index) => {
    return !fn(obj, options, index);
  };
};

let some = function (conditionFns) {
  return (obj, options, index) => {
    return conditionFns.some((fn)=>fn(obj, options, index));
  };
};

let every = function (conditionFns) {
  return (obj, options, index) => {
    return conditionFns.every((fn)=>fn(obj, options, index));
  };
};

let whenMoreData = function (parseFn) {
  return {
    decode: (expGolomb, output, options, index) => {
      if (expGolomb.bitReservoir.length) {
        return parseFn.decode(expGolomb, output, options, index);
      }
      return output;
    },
    encode: (expGolomb, input, options, index) => {
      parseFn.encode(expGolomb, input, options, index);
    }
  };
};


module.exports = {
  start: start,
  list: list,
  data: data,
  each: each,
  when: when,
  whenMoreData: whenMoreData,
  inArray: inArray,
  equals: equals,
  not: not,
  some: some,
  every: every,
  dataTypes: dataTypes
};
