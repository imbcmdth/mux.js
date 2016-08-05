'use strict';

let combinators = require('./lib/combinators');
let dataTypes = require('./lib/data-types');
let conditionals = require('./lib/conditionals');

let scalingList = require('./scaling-list');

let list = combinators.list;
let data = combinators.data;
let each = conditionals.each;

let ue = dataTypes.ue;
let u = dataTypes.u;
let v = null;


let hdrParameters = list([
  data('cpb_cnt_minus1', ue(v)),
  data('bit_rate_scale', u(4)),
  data('cpb_size_scale', u(4)),
  each((index, output) => {
    return index <= output.cpb_cnt_minus1;
  },
  list([
    data('bit_rate_value_minus1[]', ue(v)),
    data('cpb_size_value_minus1[]', ue(v)),
    data('cbr_flag[]', u(1))
  ])),
  data('initial_cpb_removal_delay_length_minus1', u(5)),
  data('cpb_removal_delay_length_minus1', u(5)),
  data('dpb_output_delay_length_minus1', u(5)),
  data('time_offset_length', u(5))
]);

module.exports = hdrParameters;
