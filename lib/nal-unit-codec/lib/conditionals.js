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
  let nameSplit = name.split(/\[(\d*)\]/);
  let property = nameSplit[0];
  let indexOverride;
  let nameArray;

  // The `nameSplit` array can either be 1 or 3 long
  if (nameSplit && nameSplit[0] !== '') {
    if (nameSplit.length > 1) {
      nameArray = true;
      indexOverride = parseFloat(nameSplit[1]);

      if (isNaN(indexOverride)) {
        indexOverride = undefined;
      }
    }
  } else {
    throw new Error('ExpGolombError: Invalid name "' + name + '".');
  }

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
  let nameSplit = name.split(/\[(\d*)\]/);
  let property = nameSplit[0];
  let indexOverride;
  let nameArray;

  // The `nameSplit` array can either be 1 or 3 long
  if (nameSplit && nameSplit[0] !== '') {
    if (nameSplit.length > 1) {
      nameArray = true;
      indexOverride = parseFloat(nameSplit[1]);

      if (isNaN(indexOverride)) {
        indexOverride = undefined;
      }
    }
  } else {
    throw new Error('ExpGolombError: Invalid name "' + name + '".');
  }

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
  when: when,
  each: each,
  inArray: inArray,
  equals: equals,
  not: not,
  some: some,
  every: every,
  whenMoreData: whenMoreData
};
