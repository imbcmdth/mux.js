'use strict';

let parser = require('./parse-exp-golomb');
let scalingList = require('./scaling-list');

let start = parser.start;
let list = parser.list;
let data = parser.data;
let each = parser.each;
let when = parser.when;
let inArray = parser.inArray;
let equals = parser.equals;
let some = parser.some;
let every = parser.every;

let ue = parser.dataTypes.ue;
let u = parser.dataTypes.u;
let se = parser.dataTypes.se;
let v = null;

let PROFILES_WITH_OPTIONAL_SPS_DATA = [
  44, 83, 86, 100, 110, 118, 122, 128,
  134, 138, 139, 244
];

let hdrParameters = list([
  data('cpb_cnt_minus1', ue(v)),
  data('bit_rate_scale', u(4)),
  data('cpb_size_scale', u(4)),
  each((index, output) => {
    return index <= output.cpbCntMinus1;
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

let vuiParamters = list([
  data('aspect_ratio_info_present_flag', u(1)),
  when(equals('aspect_ratio_info_present_flag', 1),
    list([
      data('aspect_ratio_idc', u(8)),
      when(equals('aspect_ratio_idc', 255),
        list([
          data('sar_width', u(16)),
          data('sar_height', u(16))
        ]))
    ])),
  data('overscan_info_present_flag', u(1)),
  when(equals('overscan_info_present_flag', 1),
    data('overscan_appropriate_flag', u(1))),
  data('video_signal_type_present_flag', u(1)),
  when(equals('video_signal_type_present_flag', 1),
    list([
      data('video_format', u(3)),
      data('video_full_range_flag', u(1)),
      data('colour_description_present_flag', u(1)),
      when(equals('colour_description_present_flag', 1),
        list([
          data('colour_primaries', u(8)),
          data('transfer_characteristics', u(8)),
          data('matrix_coefficients', u(8))
        ]))
    ])),
  data('chroma_loc_info_present_flag', u(1)),
  when(equals('chroma_loc_info_present_flag', 1),
    list([
      data('chroma_sample_loc_type_top_field', ue(v)),
      data('chroma_sample_loc_type_bottom_field', ue(v))
    ])),
  data('timing_info_present_flag', u(1)),
  when(equals('timing_info_present_flag', 1),
    list([
      data('num_units_in_tick', u(32)),
      data('time_scale', u(32)),
      data('fixed_frame_rate_flag', u(1))
    ])),
  data('nal_hrd_parameters_present_flag', u(1)),
  when(equals('nal_hrd_parameters_present_flag', 1), hdrParameters),
  data('vcl_hrd_parameters_present_flag', u(1)),
  when(equals('vcl_hrd_parameters_present_flag', 1), hdrParameters),
  when(
    some([
      equals('nal_hrd_parameters_present_flag', 1),
      equals('vcl_hrd_parameters_present_flag', 1)
    ]),
    data('low_delay_hrd_flag', u(1))),
  data('pic_struct_present_flag', u(1)),
  data('bitstream_restriction_flag', u(1)),
  when(equals('bitstream_restriction_flag', 1),
    list([
      data('motion_vectors_over_pic_boundaries_flag', u(1)),
      data('max_bytes_per_pic_denom', ue(v)),
      data('max_bits_per_mb_denom', ue(v)),
      data('log2_max_mv_length_horizontal', ue(v)),
      data('log2_max_mv_length_vertical', ue(v)),
      data('max_num_reorder_frames', ue(v)),
      data('max_dec_frame_buffering', ue(v))
    ]))
]);

/**
  * NOW we are ready to build an SPS parser!
  */
let spsCodec = start(
  list([
    data('profile_idc', u(8)),
    data('constraint_set0_flag', u(1)),
    data('constraint_set1_flag', u(1)),
    data('constraint_set2_flag', u(1)),
    data('constraint_set3_flag', u(1)),
    data('constraint_set4_flag', u(1)),
    data('constraint_set5_flag', u(1)),
    data('constraint_set6_flag', u(1)),
    data('constraint_set7_flag', u(1)),
    data('level_idc', u(8)),
    data('seq_parameter_set_id', ue(v)),
    when(inArray('profile_idc', PROFILES_WITH_OPTIONAL_SPS_DATA),
      list([
        data('chroma_format_idc', ue(v)),
        when(equals('chroma_format_idc', 3),
          data('separate_colour_plane_flag', u(1))),
        data('bit_depth_luma_minus8', ue(v)),
        data('bit_depth_chroma_minus8', ue(v)),
        data('qpprime_y_zero_transform_bypass_flag', u(1)),
        data('seq_scaling_matrix_present_flag', u(1)),
        when(equals('seq_scaling_matrix_present_flag', 1),
          each((index, output) => {
              return index < ((output.chromaFormatIdc !== 3) ? 8 : 12);
            },
            list([
              data('seq_scaling_list_present_flag[]', u(1)),
              when(equals('seq_scaling_list_present_flag[]', 1),
                scalingList)
            ])))
      ])),
    data('log2_max_frame_num_minus4', ue(v)),
    data('pic_order_cnt_type', ue(v)),
    when(equals('pic_order_cnt_type', 0),
      data('log2_max_pic_order_cnt_lsb_minus4', ue(v))),
    when(equals('pic_order_cnt_type', 1),
      list([
        data('delta_pic_order_always_zero_flag', u(1)),
        data('offset_for_non_ref_pic', se(v)),
        data('offset_for_top_to_bottom_field', se(v)),
        data('num_ref_frames_in_pic_order_cnt_cycle', ue(v)),
        each((index, output) => {
            return index < output.num_ref_frames_in_pic_order_cnt_cycle;
          },
          data('offset_for_ref_frame[]', se(v)))
      ])),
    data('max_num_ref_frames', ue(v)),
    data('gaps_in_frame_num_value_allowed_flag', u(1)),
    data('pic_width_in_mbs_minus1', ue(v)),
    data('pic_height_in_map_units_minus1', ue(v)),
    data('frame_mbs_only_flag', u(1)),
    when(equals('frame_mbs_only_flag', 0),
      data('mb_adaptive_frame_field_flag', u(1))),
    data('direct_8x8_inference_flag', u(1)),
    data('frame_cropping_flag', u(1)),
    when(equals('frame_cropping_flag', 1),
      list([
        data('frame_crop_left_offset', ue(v)),
        data('frame_crop_right_offset', ue(v)),
        data('frame_crop_top_offset', ue(v)),
        data('frame_crop_bottom_offset', ue(v))
      ])),
    data('vui_parameters_present_flag', u(1)),
    when(equals('vui_parameters_present_flag', 1), vuiParamters)
  ]));

module.exports = spsCodec;
