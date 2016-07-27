/**
 * Tools for encoding and decoding ExpGolomb data from a bit-string
 */
'use strict';

let ExpGolombDecoder = function (bitString) {
  this.bitReservoir = bitString;
};

ExpGolombDecoder.prototype.countLeadingZeros = function () {
  let i = 0;

  for (let i = 0; i < this.bitReservoir.length; i++) {
    if (this.bitReservoir[i] === '1') {
      return i;
    }
  }

  return -1;
};

ExpGolombDecoder.prototype.readUnsignedExpGolomb = function () {
  let zeros = this.countLeadingZeros();
  let bitCount = zeros * 2 + 1;

  let val = parseInt(this.bitReservoir.slice(zeros, bitCount), 2);

  val -= 1;

  this.bitReservoir = this.bitReservoir.slice(bitCount);

  return val;
};

ExpGolombDecoder.prototype.readExpGolomb = function () {
  let val = this.readUnsignedExpGolomb();

  if (val % 2 === 0) {
    val = val / -2;
  } else {
    val = val / 2 - 1;
  }

  return val;
};

ExpGolombDecoder.prototype.readBits = function (bitCount) {
  let val = parseInt(this.bitReservoir.slice(0, bitCount), 2);

  this.bitReservoir = this.bitReservoir.slice(bitCount);

  return val;
};


ExpGolombDecoder.prototype.readUnsignedByte = function () {
  return this.writeBits(8);
};

let ExpGolombEncoder = function (bitString) {
  this.bitReservoir = bitString || '';
};

ExpGolombEncoder.prototype.writeUnsignedExpGolomb = function (value) {
  let tempStr = '';
  let bitValue = (value + 1).toString(2);
  let numBits = bitValue.length - 1;

  for (let i = 0; i < numBits; i++) {
    tempStr += '0';
  }

  this.bitReservoir += tempStr + bitValue;
};

ExpGolombEncoder.prototype.writeExpGolomb = function (value) {
  if (value <= 0) {
    value = -value * 2;
  } else {
    value = value * 2 - 1
  }

  this.writeUnsignedExpGolomb(value);
};

ExpGolombEncoder.prototype.writeBits = function (bitWidth, value) {
  let tempStr = '';
  let bitValue = (value & ((1 << bitWidth)-1)).toString(2);
  let numBits = bitWidth - bitValue.length;

  for (let i = 0; i < numBits; i++) {
    tempStr += '0';
  }

  this.bitReservoir += tempStr + bitValue;
};

ExpGolombEncoder.prototype.writeUnsignedByte = function (value) {
  this.writeBits(8, value);
};

let typedArrayToBitString = (data) => {
  var array = [];
  var bytesPerElement = data.BYTES_PER_ELEMENT || 1;
  var prefixZeros = '';

  for (let i = 0; i < data.length; i++) {
    array.push(data[i]);
  }

  for (let i = 0; i < bytesPerElement; i++) {
    prefixZeros += '00000000';
  }

  return array
    .map((n) => (prefixZeros + n.toString(2)).slice(-bytesPerElement * 8))
    .join('');
};

let bitStringToTypedArray = (bitString) => {
  let bitsNeeded = 8 - (bitString.length % 8);

  // Pad with zeros to make length a multiple of 8
  for (let i = 0; bitsNeeded !==8 && i < bitsNeeded; i++) {
    bitString += '0';
  }

  let outputArray = bitString.match(/(.{8})/g);
  let numberArray = outputArray.map((n) => parseInt(n, 2));

  return new Uint8Array(numberArray);
};

let removeRBSPTrailingBits = (bits) => {
  return bits.split(/10+$/)[0];
};

let appendRBSPTrailingBits = (bits) => {
  let bitString = bits + '10000000';

  return bitString.slice(0, -(bitString.length % 8));
};

module.exports = {
  // Write:
  ExpGolombDecoder: ExpGolombDecoder,

  // Read:
  ExpGolombEncoder: ExpGolombEncoder,

  // Helpers:
  typedArrayToBitString: typedArrayToBitString,
  bitStringToTypedArray: bitStringToTypedArray,
  removeRBSPTrailingBits: removeRBSPTrailingBits,
  appendRBSPTrailingBits: appendRBSPTrailingBits
};
