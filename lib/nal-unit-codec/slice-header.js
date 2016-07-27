'use strict';

let parser = require('./parse-exp-golomb');

let start = parser.start;
let list = parser.list;
let data = parser.data;
let each = parser.each;
let when = parser.when;
let inArray = parser.inArray;
let equals = parser.equals;
let some = parser.some;
let every = parser.every;
let not = parser.not;
let whenMoreData = parser.whenMoreData;

let ue = parser.dataTypes.ue;
let u = parser.dataTypes.u;
let se = parser.dataTypes.se;
let v = null;

let sliceType = {
  P: [0, 5],
  B: [1, 6],
  I: [2, 7],
  SP: [3, 8],
  SI: [4, 9]
};

let frameNumBits = (expGolomb, data, options, index) => {
  return options.log2_max_frame_num_minus4 + 4;
};
let picOrderCntBits = (expGolomb, data, options, index) => {
  return options.log2_max_pic_order_cnt_lsb_minus4 + 4;
};
let sliceGroupChangeCycleBits = (expGolomb, data, options, index) => {};

let useWeightedPredictionTable = some([
  every([
    equals('weighted_pred_flag', 1),
    some([
      inArray('slice_type', sliceType.P),
      inArray('slice_type', sliceType.SP)
    ])
  ]),
  every([
    equals('weighted_bipred_idc', 1),
    inArray('slice_type', sliceType.B),
  ])
]);

let sliceHeader = list([
    data('first_mb_in_slice', ue(v)),
    data('slice_type', ue(v)),
    data('pic_parameter_set_id', ue(v)),
    when(equals('separate_colour_plane_flag', 1),
      data('colour_plane_id', u(2))),
    data('frame_num', u(frameNumBits)),
    when(equals('frame_mbs_only_flag', 0),
      list([
        data('field_pic_flag', u(1)),
        when(equals('field_pic_flag', 1),
          data('bottom_field_flag', u(1))),
      ])),
    when(equals('idrPicFlag', 1),
      data('idr_pic_id', ue(v))),
    when(equals('pic_order_cnt_type', 0),
      list([
        data('pic_order_cnt_lsb', u(picOrderCntBits)),
        when(every([
          equals('bottom_field_pic_order_in_frame_present_flag', 1),
          equals('field_pic_flag', 0)
        ]), data('delta_pic_order_cnt_bottom', se(v)))
      ])),
    when(every([
        equals('pic_order_cnt_type', 1),
        equals('delta_pic_order_always_zero_flag', 0)
      ]), data('delta_pic_order_cnt[0]', se(v))),
    when(every([
        equals('bottom_field_pic_order_in_frame_present_flag', 1),
        equals('field_pic_flag', 0)
      ]), data('delta_pic_order_cnt[1]', se(v))),
    when(equals('redundant_pic_cnt_present_flag', 1),
      data('redundant_pic_cnt', ue(v))),
    when(inArray('slice_type', sliceType.B),
      data('direct_spatial_mv_pred_flag', u(1))),
    when(some([
        inArray('slice_type', sliceType.P),
        inArray('slice_type', sliceType.SP),
        inArray('slice_type', sliceType.B)
      ]), list([
        data('num_ref_idx_active_override_flag', u(1)),
        when(equals('num_ref_idx_active_override_flag', 1),
          list([
            data('num_ref_idx_l0_active_minus1', ue(v)),
            when(inArray('slice_type', sliceType.B),
              data('num_ref_idx_l1_active_minus1', ue(v)))
          ]))
      ])),
/*    when(some([
        equals('nal_unit_type', 20),
        equals('nal_unit_type', 21)
      ]), refPicListMvcModification),
    when(every([
        not(equals('nal_unit_type', 20)),
        not(equals('nal_unit_type', 21))
      ]), refPicListModification),
    when(useWeightedPredictionTable, predWeightTable),
    when(not(equals('nal_ref_idc', 0)), decRefPicMarking),
    when(every([
        equals('entropy_coding_mode_flag', 1)),
        not(inArray('slice_type', sliceType.I)),
        not(inArray('slice_type', sliceType.SI))
      ]), data('cabac_init_idc', ue(v))),
    data('slice_qp_delta', se(v)),
    when(inArray('slice_type', sliceType.SP),
      data('sp_for_switch_flag', u(1))),
    when(some([
        inArray('slice_type', sliceType.SP),
        inArray('slice_type', sliceType.SI),
      ]), data('slice_qs_delta', se(v))),
    when(equals('deblocking_filter_control_present_flag', 1),
      list([
        data('disable_deblocking_filter_idc', ue(v)),
        when(not(equals('disable_deblocking_filter_idc', 1)),
          list([
            data('slice_alpha_c0_offset_div2', se(v)),
            data('slice_beta_offset_div2', se(v)),
          ]))
      ])),
    when(every([
        not(equals('num_slice_groups_minus1', 0)),
        some([
          equals('slice_group_map_type', 3),
          equals('slice_group_map_type', 4),
          equals('slice_group_map_type', 5),
        ])
      ]),
      data('slice_group_change_cycle', u(sliceGroupChangeCycleBits)))*/
]);

module.exports = sliceHeader;
