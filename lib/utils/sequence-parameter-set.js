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

let PROFILES_WITH_OPTIONAL_SPS_DATA = [
  44, 83, 86, 100, 110, 118, 122, 128,
  134, 138, 139, 244
];

let hdrParameters = list([
  data('cpbCntMinus1', 'ue(v)'),
  data('bitRateScale', 'u(4)'),
  data('cpbSizeScale', 'u(4)'),
  each((index, output) => {
    return index <= output.cpbCntMinus1;
  },
  list([
    data('bitRateValueMinus1[]', 'ue(v)'),
    data('cpbSizeValueMinus1[]', 'ue(v)'),
    data('cbrFlag[]', 'u(1)')
  ])),
  data('initialCpbRemovalDelayLengthMinus1', 'u(5)'),
  data('cpbRemovalDelayLengthMinus1', 'u(5)'),
  data('dpbOutputDelayLengthMinus1', 'u(5)'),
  data('timeOffsetLength', 'u(5)')
]);

let vuiParamters = list([
  data('aspectRatioInfoPresentFlag', 'u(1)'),
  when(equals('aspectRatioInfoPresentFlag', 1),
    list([
      data('aspectRatioIdc', 'u(8)'),
      when(equals('aspectRatioIdc', 255),
        list([
          data('sarWidth', 'u(16)'),
          data('sarHeight', 'u(16)')
        ]))
    ])),
  data('overscanInfoPresentFlag', 'u(1)'),
  when(equals('overscanInfoPresentFlag', 1),
    data('overscanAppropriateFlag', 'u(1)')),
  data('videoSignalTypePresentFlag', 'u(1)'),
  when(equals('videoSignalTypePresentFlag', 1),
    list([
      data('videoFormat', 'u(3)'),
      data('videoFullRangeFlag', 'u(1)'),
      data('colourDescriptionPresentFlag', 'u(1)'),
      when(equals('colourDescriptionPresentFlag', 1),
        list([
          data('colourPrimaries', 'u(8)'),
          data('transferCharacteristics', 'u(8)'),
          data('matrixCoefficients', 'u(8)')
        ]))
    ])),
  data('chromaLocInfoPresentFlag', 'u(1)'),
  when(equals('chromaLocInfoPresentFlag', 1),
    list([
      data('chroma_sample_loc_type_top_field', 'ue(v)'),
      data('chroma_sample_loc_type_bottom_field', 'ue(v)')
    ])),
  data('timingInfoPresentFlag', 'u(1)'),
  when(equals('timingInfoPresentFlag', 1),
    list([
      data('numUnitsInTick', 'u(32)'),
      data('timeScale', 'u(32)'),
      data('fixedFrameRateFlag', 'u(1)')
    ])),
  data('nalHrdParametersPresentFlag', 'u(1)'),
  when(equals('nalHrdParametersPresentFlag', 1), hdrParameters),
  data('vclHrdParametersPresentFlag', 'u(1)'),
  when(equals('vclHrdParametersPresentFlag', 1), hdrParameters),
  when(
    some([
      equals('nalHrdParametersPresentFlag', 1),
      equals('vclHrdParametersPresentFlag', 1)
    ]),
    data('lowDelayHrdFlag', 'u(1)')),
  data('picStructPresentFlag', 'u(1)'),
  data('bitstreamRestrictionFlag', 'u(1)'),
  when(equals('bitstreamRestrictionFlag', 1),
    list([
      data('motionVectorsOverPicBoundariesFlag', 'u(1)'),
      data('maxBytesPerPicDenom', 'ue(v)'),
      data('maxBitsPerMbDenom', 'ue(v)'),
      data('log2MaxMvLengthHorizontal', 'ue(v)'),
      data('log2MaxMvLengthVertical', 'ue(v)'),
      data('maxNumReorderFrames', 'ue(v)'),
      data('maxDecFrameBuffering', 'ue(v)')
    ]))
]);

/**
  * NOW we are ready to build an SPS parser!
  */
let spsCodec = start(
  list([
    data('profileIdc', 'u(8)'),
    data('profileCompatibility', 'u(8)'), // constraint_set[0-5]_flag & reserved_bits(3)
    data('levelIdc', 'u(8)'),
    data('seqParameterSetId', 'ue(v)'),
    when(inArray('profileIdc', PROFILES_WITH_OPTIONAL_SPS_DATA),
      list([
        data('chromeFormatIdc', 'ue(v)'),
        when(equals('chromeFormatIdc', 3),
          data('separateColourPlaneFlag', 'u(1)')),
        data('bitDepthLumaMinus8', 'ue(v)'),
        data('bitDepthChromaMinus8', 'ue(v)'),
        data('qpprimeYZeroTransformBypassFlag', 'u(1)'),
        data('seqScalingMatrixPresentFlag', 'u(1)'),
        when(equals('seqScalingMatrixPresentFlag', 1),
          each((index, output) => {
              return index < ((output.chromaFormatIdc !== 3) ? 8 : 12);
            },
            list([
              data('seqScalingListPresentFlag[]', 'u(1)'),
              when(equals('seqScalingListPresentFlag[]', 1),
                scalingList)
            ])))
      ])),
    data('log2MaxFrameNumMinus4', 'ue(v)'),
    data('picOrderCntType', 'ue(v)'),
    when(equals('picOrderCntType', 0),
      data('log2MaxPicOrderCntLsbMinus4', 'ue(v)')),
    when(equals('picOrderCntType', 1),
      list([
        data('deltaPicOrderAlwaysZeroFlag', 'u(1)'),
        data('offsetForNonRefPic', 'se(v)'),
        data('offsetForTopToBottomField', 'se(v)'),
        data('numRefFramesInPicOrderCntCycle', 'ue(v)'),
        each((index, output) => {
            return index < output.numRefFramesInPicOrderCntCycle;
          },
          data('offsetForRefFrame[]', 'se(v)'))
      ])),
    data('maxNumRefFrames', 'ue(v)'),
    data('gapsInFrameNumValueAllowedFlag', 'u(1)'),
    data('picWidthInMbsMinus1', 'ue(v)'),
    data('picHeightInMapUnitsMinus1', 'ue(v)'),
    data('frameMbsOnlyFlag', 'u(1)'),
    when(equals('frameMbsOnlyFlag', 0),
      data('mbAdaptiveFrameFieldFlag', 'u(1)')),
    data('direct8x8InferenceFlag', 'u(1)'),
    data('frameCroppingFlag', 'u(1)'),
    when(equals('frameCroppingFlag', 1),
      list([
        data('frameCropLeftOffset', 'ue(v)'),
        data('frameCropRightOffset', 'ue(v)'),
        data('frameCropTopOffset', 'ue(v)'),
        data('frameCropBottomOffset', 'ue(v)')
      ])),
    data('vuiParametersPresentFlag', 'u(1)'),
    when(equals('vuiParametersPresentFlag', 1), vuiParamters)
  ]));

module.exports = spsCodec;
