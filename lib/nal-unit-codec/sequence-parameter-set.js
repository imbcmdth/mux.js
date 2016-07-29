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
let not = parser.not;
let debug = parser.debug;

let ue = parser.dataTypes.ue;
let u = parser.dataTypes.u;
let se = parser.dataTypes.se;
let val = parser.dataTypes.val;
let v = null;

let PROFILES_WITH_OPTIONAL_SPS_DATA = [
  44, 83, 86, 100, 110, 118, 122, 128,
  134, 138, 139, 244
];

let sampleRatioCalc = list([
  /*
    1:1
   7680x4320 16:9 frame without horizontal overscan
   3840x2160 16:9 frame without horizontal overscan
   1280x720 16:9 frame without horizontal overscan
   1920x1080 16:9 frame without horizontal overscan (cropped from 1920x1088)
   640x480 4:3 frame without horizontal overscan
   */
  when(equals('aspect_ratio_idc', 1),
    data('sample_ratio', val(1))),
  /*
    12:11
   720x576 4:3 frame with horizontal overscan
   352x288 4:3 frame without horizontal overscan
   */
  when(equals('aspect_ratio_idc', 2),
    data('sample_ratio', val(12 / 11))),
  /*
    10:11
   720x480 4:3 frame with horizontal overscan
   352x240 4:3 frame without horizontal overscan
   */
  when(equals('aspect_ratio_idc', 3),
    data('sample_ratio', val(10 / 11))),
  /*
    16:11
   720x576 16:9 frame with horizontal overscan
   528x576 4:3 frame without horizontal overscan
   */
  when(equals('aspect_ratio_idc', 4),
    data('sample_ratio', val(16 / 11))),
  /*
    40:33
   720x480 16:9 frame with horizontal overscan
   528x480 4:3 frame without horizontal overscan
   */
  when(equals('aspect_ratio_idc', 5),
    data('sample_ratio', val(40 / 33))),
  /*
    24:11
   352x576 4:3 frame without horizontal overscan
   480x576 16:9 frame with horizontal overscan
   */
  when(equals('aspect_ratio_idc', 6),
    data('sample_ratio', val(24 / 11))),
  /*
    20:11
   352x480 4:3 frame without horizontal overscan
   480x480 16:9 frame with horizontal overscan
   */
  when(equals('aspect_ratio_idc', 7),
    data('sample_ratio', val(20 / 11))),
  /*
    32:11
   352x576 16:9 frame without horizontal overscan
   */
  when(equals('aspect_ratio_idc', 8),
    data('sample_ratio', val(32 / 11))),
  /*
    80:33
   352x480 16:9 frame without horizontal overscan
   */
  when(equals('aspect_ratio_idc', 9),
    data('sample_ratio', val(80 / 33))),
  /*
    18:11
   480x576 4:3 frame with horizontal overscan
   */
  when(equals('aspect_ratio_idc', 10),
    data('sample_ratio', val(18 / 11))),
  /*
    15:11
   480x480 4:3 frame with horizontal overscan
   */
  when(equals('aspect_ratio_idc', 11),
    data('sample_ratio', val(15 / 11))),
  /*
    64:33
   528x576 16:9 frame with horizontal overscan
   */
  when(equals('aspect_ratio_idc', 12),
    data('sample_ratio', val(64 / 33))),
  /*
    160:99
   528x480 16:9 frame without horizontal overscan
   */
  when(equals('aspect_ratio_idc', 13),
    data('sample_ratio', val(160 / 99))),
  /*
    4:3
   1440x1080 16:9 frame without horizontal overscan
   */
  when(equals('aspect_ratio_idc', 14),
    data('sample_ratio', val(4 / 3))),
  /*
    3:2
   1280x1080 16:9 frame without horizontal overscan
   */
  when(equals('aspect_ratio_idc', 15),
    data('sample_ratio', val(3 / 2))),
  /*
    2:1
   960x1080 16:9 frame without horizontal overscan
   */
  when(equals('aspect_ratio_idc', 16),
    data('sample_ratio', val(2 / 1))),
  /* Extended_SAR */
  when(equals('aspect_ratio_idc', 255),
    list([
      data('sar_width', u(16)),
      data('sar_height', u(16)),
      data('sample_ratio',
        val((expGolomb, output, options) => output.sar_width / output.sar_height))
    ]))
]);

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

let vuiParamters = list([
  data('aspect_ratio_info_present_flag', u(1)),
  when(equals('aspect_ratio_info_present_flag', 1),
    list([
      data('aspect_ratio_idc', u(8)),
      sampleRatioCalc,
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

let getChromaFormatIdcValue = {
  read: (expGolomb, output, options, index) => {
    return output.chroma_format_idc || options.chroma_format_idc;
  },
  write:()=>{}
};

/**
  * NOW we are ready to build an SPS parser!
  */
let spsCodec = start('seq_parameter_set',
  list([
    // defaults
    data('chroma_format_idc', val(1)),
    data('video_format', val(5)),
    data('color_primaries', val(2)),
    data('transfer_characteristics', val(2)),
    data('sample_ratio', val(1.0)),

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
        when(not(equals('chroma_format_idc', 3)),
          data('separate_colour_plane_flag', val(0))),
        data('bit_depth_luma_minus8', ue(v)),
        data('bit_depth_chroma_minus8', ue(v)),
        data('qpprime_y_zero_transform_bypass_flag', u(1)),
        data('seq_scaling_matrix_present_flag', u(1)),
        when(equals('seq_scaling_matrix_present_flag', 1),
          each((index, output) => {
              return index < ((output.chroma_format_idc !== 3) ? 8 : 12);
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
    when(equals('vui_parameters_present_flag', 1), vuiParamters),
    // The following field is a derived value that is used for parsing
    // slice headers
    when(equals('separate_colour_plane_flag', 1),
      data('ChromaArrayType', val(0))),
    when(equals('separate_colour_plane_flag', 0),
      data('ChromaArrayType', getChromaFormatIdcValue)),
    debug('sps')
  ]));

module.exports = spsCodec;
