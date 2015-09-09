(function(window, muxjs) {
'use strict';

var
  DataView = window.DataView,
  /**
   * Returns the string representation of an ASCII encoded four byte buffer.
   * @param buffer {Uint8Array} a four-byte buffer to translate
   * @return {string} the corresponding string
   */
  parseType = function(buffer) {
    var result = '';
    result += String.fromCharCode(buffer[0]);
    result += String.fromCharCode(buffer[1]);
    result += String.fromCharCode(buffer[2]);
    result += String.fromCharCode(buffer[3]);
    return result;
  },
  parseMp4Date = function(seconds) {
    return new Date(seconds * 1000 - 2082844800000);
  },
  parseSampleFlags = function(flags) {
    return {
      isLeading: (flags[0] & 0x0c) >>> 2,
      dependsOn: flags[0] & 0x03,
      isDependedOn: (flags[1] & 0xc0) >>> 6,
      hasRedundancy: (flags[1] & 0x30) >>> 4,
      paddingValue: (flags[1] & 0x0e) >>> 1,
      isNonSyncSample: flags[1] & 0x01,
      degradationPriority: (flags[2] << 8) | flags[3]
    };
  },
  nalParse = function(avcStream) {
    var
      avcView = new DataView(avcStream.buffer, avcStream.byteOffset, avcStream.byteLength),
      result = [],
      i,
      length,
      nal;

    for (i = 0; i + 4 < avcStream.length; i += length) {
      length = avcView.getUint32(i);
      i += 4;

      // bail if this doesn't appear to be an H264 stream
      if (length <= 0) {
        return;
      }

      nal = avcStream.subarray(i + 1, i + length);

      switch(avcStream[i] & 0x1F) {
      case 0x01:
        result.push(parseNal('slice_layer_without_partitioning_rbsp', nal));
        break;
      case 0x05:
        result.push(parseNal('slice_layer_without_partitioning_rbsp_idr', nal));
        break;
      case 0x06:
        result.push(parseNal('sei_rbsp', nal));
        break;
      case 0x07:
        result.push(parseSps(nal));
        break;
      case 0x08:
        result.push(parsePps(nal));
        break;
      case 0x09:
        result.push(parseNal('access_unit_delimiter_rbsp', nal));
        break;
      default:
        result.push(parseNal(avcStream[i] & 0x1F, nal));
        break;
      }
    }
    return result;
  },
  parseNal = function(name, data) {
    return {
      type: name,
      size: data.byteLength
    };
  },
  parseSps = function(sps) {
    var
      escapedRbsp = discardEmulationPreventionBytes(sps),
      SPS = readSequenceParameterSet(escapedRbsp);

    return {
      type: 'seq_parameter_set_rbsp',
      size: sps.byteLength,
      data: SPS
    };
  },
  parsePps = function(pps) {
    var
      escapedRbsp = discardEmulationPreventionBytes(pps),
      PPS = readPictureParameterSet(escapedRbsp);

    return {
      type: 'pic_parameter_set_rbsp',
      size: pps.byteLength,
      data: PPS
    };
  },
  discardEmulationPreventionBytes = function(data) {
    var
      length = data.byteLength,
      emulationPreventionBytesPositions = [],
      i = 1,
      newLength, newData;

    // Find all `Emulation Prevention Bytes`
    while (i < length - 2) {
      if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0x03) {
        emulationPreventionBytesPositions.push(i + 2);
        i += 2;
      } else {
        i++;
      }
    }

    // If no Emulation Prevention Bytes were found just return the original
    // array
    if (emulationPreventionBytesPositions.length === 0) {
      return data;
    }

    // Create a new array to hold the NAL unit data
    newLength = length - emulationPreventionBytesPositions.length;
    newData = new Uint8Array(newLength);
    var sourceIndex = 0;

    for (i = 0; i < newLength; sourceIndex++, i++) {
      if (sourceIndex === emulationPreventionBytesPositions[0]) {
        // Skip this byte
        sourceIndex++;
        // Remove this position index
        emulationPreventionBytesPositions.shift();
      }
      newData[i] = data[sourceIndex];
    }

    return newData;
  },
  readPictureParameterSet = function(data) {
    var
      output = {},
      expGolombDecoder,
      i;

    expGolombDecoder = new muxjs.ExpGolomb(data);

    output.pic_parameter_set_id = expGolombDecoder.readUnsignedExpGolomb();
    output.seq_parameter_set_id = expGolombDecoder.readUnsignedExpGolomb();

    output.entropy_coding_mode_flag = expGolombDecoder.readBits(1);
    output.pic_order_present_flag = expGolombDecoder.readBits(1);

    output.num_slice_groups_minus1 = expGolombDecoder.readUnsignedExpGolomb();

    if (output.num_slice_groups_minus1 > 0) {
      output.slice_group_map_type = expGolombDecoder.readUnsignedExpGolomb();

      if (output.slice_group_map_type === 0) {
        output.slice_groups = [];
        for (i = 0; i <= output.num_slice_groups_minus1; i++) {
          output.slice_groups[i] = {};
          output.slice_groups[i].run_length_minus1 = expGolombDecoder.readUnsignedExpGolomb();
        }
      } else if (output.slice_group_map_type === 2) {
        output.slice_groups = [];
        for (i = 0; i < output.num_slice_groups_minus1; i++) {
          output.slice_groups[i] = {};
          output.slice_groups[i].top_left = expGolombDecoder.readUnsignedExpGolomb();
          output.slice_groups[i].bottom_right = expGolombDecoder.readUnsignedExpGolomb();
        }
      } else if (output.slice_group_map_type === 3 ||
                 output.slice_group_map_type === 4 ||
                 output.slice_group_map_type === 5) {
        output.slice_group_change_direction_flag = expGolombDecoder.readBits(1);
        output.slice_group_change_rate_minus1 = expGolombDecoder.readUnsignedExpGolomb();
      } else if (output.slice_group_map_type === 6) {
        output.pic_size_in_map_units_minus1 = expGolombDecoder.readUnsignedExpGolomb();
        output.slice_groups = [];
        for (i = 0; i <= output.pic_size_in_map_units_minus1; i++) {
          output.slice_groups[i] = {};
          output.slice_groups[i].slice_group_id = expGolombDecoder.readUnsignedExpGolomb();
        }
      }
    }

    output.num_ref_idx_l0_active_minus1 = expGolombDecoder.readUnsignedExpGolomb();
    output.num_ref_idx_l1_active_minus1 = expGolombDecoder.readUnsignedExpGolomb();

    output.weighted_pred_flag = expGolombDecoder.readBits(1);
    output.weighted_bipred_idc = expGolombDecoder.readBits(2);

    output.pic_init_qp_minus26 = expGolombDecoder.readExpGolomb();
    output.pic_init_qs_minus26 = expGolombDecoder.readExpGolomb();
    output.chroma_qp_index_offset = expGolombDecoder.readExpGolomb();

    output.deblocking_filter_control_present_flag = expGolombDecoder.readBits(1);
    output.constrained_intra_pred_flag = expGolombDecoder.readBits(1);
    output.redundant_pic_cnt_present_flag = expGolombDecoder.readBits(1);

    return output;
  },
  readSequenceParameterSet = function(data) {
    var
      output = {},
      expGolombDecoder,
      i;

    expGolombDecoder = new muxjs.ExpGolomb(data);
    output.profileIdc = expGolombDecoder.readUnsignedByte(); // profile_idc
    output.profileCompatibility = expGolombDecoder.readUnsignedByte(); // constraint_set[0-5]_flag
    output.levelIdc = expGolombDecoder.readUnsignedByte(); // level_idc u(8)
    output.seq_parameter_set_id = expGolombDecoder.readUnsignedExpGolomb(); // seq_parameter_set_id

    // some profiles have more optional data we don't need
    if (output.profileIdc === 100 ||
        output.profileIdc === 110 ||
        output.profileIdc === 122 ||
        output.profileIdc === 244 ||
        output.profileIdc ===  44 ||
        output.profileIdc ===  83 ||
        output.profileIdc ===  86 ||
        output.profileIdc === 118 ||
        output.profileIdc === 128 ||
        output.profileIdc === 138 ||
        output.profileIdc === 139 ||
        output.profileIdc === 134) {
      output.chromaFormatIdc = expGolombDecoder.readUnsignedExpGolomb();
      if (chromaFormatIdc === 3) {
        output.separate_colour_plane_flag = expGolombDecoder.readBits(1); // separate_colour_plane_flag
      }
      output.bit_depth_luma_minus8 = expGolombDecoder.readUnsignedExpGolomb(); // bit_depth_luma_minus8
      output.bit_depth_chroma_minus8 = expGolombDecoder.readUnsignedExpGolomb(); // bit_depth_chroma_minus8
      output.qpprime_y_zero_transform_bypass_flag = expGolombDecoder.readBits(1); // qpprime_y_zero_transform_bypass_flag
      if (output.seq_scaling_matrix_present_flag = expGolombDecoder.readBoolean()) { // seq_scaling_matrix_present_flag
        output.seq_scaling_list = [];
        scalingListCount = (chromaFormatIdc !== 3) ? 8 : 12;
        for (i = 0; i < scalingListCount; i++) {
          output.seq_scaling_list[i] = {};
          if (output.seq_scaling_list[i].seq_scaling_list_present_flag = expGolombDecoder.readBoolean()) { // seq_scaling_list_present_flag[ i ]
            if (i < 6) {
              skipScalingList(16, expGolombDecoder, output.seq_scaling_list[i]);
            } else {
              skipScalingList(64, expGolombDecoder, output.seq_scaling_list[i]);
            }
          }
        }
      }
    }

    output.log2_max_frame_num_minus4 = expGolombDecoder.readUnsignedExpGolomb(); // log2_max_frame_num_minus4
    output.picOrderCntType = expGolombDecoder.readUnsignedExpGolomb();

    if (output.picOrderCntType === 0) {
      output.log2_max_pic_order_cnt_lsb_minus4 = expGolombDecoder.readUnsignedExpGolomb(); //log2_max_pic_order_cnt_lsb_minus4
    } else if (output.picOrderCntType === 1) {
      output.delta_pic_order_always_zero_flag = expGolombDecoder.readBits(1); // delta_pic_order_always_zero_flag
      output.offset_for_non_ref_pic = expGolombDecoder.readExpGolomb(); // offset_for_non_ref_pic
      output.offset_for_top_to_bottom_field = expGolombDecoder.readExpGolomb(); // offset_for_top_to_bottom_field
      output.numRefFramesInPicOrderCntCycle = expGolombDecoder.readUnsignedExpGolomb();
      output.offset_for_ref_frame = [];
      for(i = 0; i < output.numRefFramesInPicOrderCntCycle; i++) {
        output.offset_for_ref_frame[i] = expGolombDecoder.readExpGolomb(); // offset_for_ref_frame[ i ]
      }
    }

    output.max_num_ref_frames = expGolombDecoder.readUnsignedExpGolomb(); // max_num_ref_frames
    output.gaps_in_frame_num_value_allowed_flag = expGolombDecoder.readBits(1); // gaps_in_frame_num_value_allowed_flag

    output.picWidthInMbsMinus1 = expGolombDecoder.readUnsignedExpGolomb();
    output.picHeightInMapUnitsMinus1 = expGolombDecoder.readUnsignedExpGolomb();

    output.frameMbsOnlyFlag = expGolombDecoder.readBits(1);
    if (output.frameMbsOnlyFlag === 0) {
      output.mb_adaptive_frame_field_flag = expGolombDecoder.readBits(1); // mb_adaptive_frame_field_flag
    }

    output.direct_8x8_inference_flag = expGolombDecoder.readBits(1); // direct_8x8_inference_flag
    if (output.frame_cropping_flag = expGolombDecoder.readBoolean()) { // frame_cropping_flag
      output.frameCropLeftOffset = expGolombDecoder.readUnsignedExpGolomb();
      output.frameCropRightOffset = expGolombDecoder.readUnsignedExpGolomb();
      output.frameCropTopOffset = expGolombDecoder.readUnsignedExpGolomb();
      output.frameCropBottomOffset = expGolombDecoder.readUnsignedExpGolomb();
    }

    return output;
  },
  skipScalingList = function(count, expGolombDecoder, output) {
    var
      lastScale = 8,
      nextScale = 8,
      j,
      deltaScale;

    output.scales = [];
    for (j = 0; j < count; j++) {
      output.scales[j] = {};
      if (nextScale !== 0) {
        output.scales[j].deltaScale = expGolombDecoder.readExpGolomb();
        output.scales[j].nextScale = (lastScale + deltaScale + 256) % 256;
      }

      lastScale = (nextScale === 0) ? lastScale : nextScale;
    }
  },
  // registry of handlers for individual mp4 box types
  parse = {
    // codingname, not a first-class box type. stsd entries share the
    // same format as real boxes so the parsing infrastructure can be
    // shared
    avc1: function(data) {
      var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      return {
        dataReferenceIndex: view.getUint16(6),
        width:  view.getUint16(24),
        height: view.getUint16(26),
        horizresolution: view.getUint16(28) + (view.getUint16(30) / 16),
        vertresolution: view.getUint16(32) + (view.getUint16(34) / 16),
        frameCount: view.getUint16(40),
        depth: view.getUint16(74),
        config: muxjs.inspectMp4(data.subarray(78, data.byteLength))
      };
    },
    avcC: function(data) {
      var
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        result = {
          configurationVersion: data[0],
          avcProfileIndication: data[1],
          profileCompatibility: data[2],
          avcLevelIndication: data[3],
          lengthSizeMinusOne: data[4] & 0x03,
          sps: [],
          pps: []
        },
        numOfSequenceParameterSets = data[5] & 0x1f,
        numOfPictureParameterSets,
        nalSize,
        offset,
        i;

      // iterate past any SPSs
      offset = 6;
      for (i = 0; i < numOfSequenceParameterSets; i++) {
        nalSize = view.getUint16(offset);
        offset += 2;
        result.sps.push(new Uint8Array(data.subarray(offset, offset + nalSize)));
        offset += nalSize;
      }
      // iterate past any PPSs
      numOfPictureParameterSets = data[offset];
      offset++;
      for (i = 0; i < numOfPictureParameterSets; i++) {
        nalSize = view.getUint16(offset);
        offset += 2;
        result.pps.push(new Uint8Array(data.subarray(offset, offset + nalSize)));
        offset += nalSize;
      }
      return result;
    },
    btrt: function(data) {
      var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      return {
        bufferSizeDB: view.getUint32(0),
        maxBitrate: view.getUint32(4),
        avgBitrate: view.getUint32(8)
      };
    },
    esds: function(data) {
      return {
        version: data[0],
        flags: new Uint8Array(data.subarray(1, 4)),
        esId: (data[6] << 8) | data[7],
        streamPriority: data[8] & 0x1f,
        decoderConfig: {
          objectProfileIndication: data[11],
          streamType: (data[12] >>> 2) & 0x3f,
          bufferSize: (data[13] << 16) | (data[14] << 8) | data[15],
          maxBitrate: (data[16] << 24) |
            (data[17] << 16) |
            (data[18] <<  8) |
            data[19],
          avgBitrate: (data[20] << 24) |
            (data[21] << 16) |
            (data[22] <<  8) |
            data[23],
          decoderConfigDescriptor: {
            tag: data[24],
            length: data[25],
            audioObjectType: (data[26] >>> 3) & 0x1f,
            samplingFrequencyIndex: ((data[26] & 0x07) << 1) |
              ((data[27] >>> 7) & 0x01),
            channelConfiguration: (data[27] >>> 3) & 0x0f
          }
        }
      };
    },
    ftyp: function(data) {
      var
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        result = {
          majorBrand: parseType(data.subarray(0, 4)),
          minorVersion: view.getUint32(4),
          compatibleBrands: []
        },
        i = 8;
      while (i < data.byteLength) {
        result.compatibleBrands.push(parseType(data.subarray(i, i + 4)));
        i += 4;
      }
      return result;
    },
    dinf: function(data) {
      return {
        boxes: muxjs.inspectMp4(data)
      };
    },
    dref: function(data) {
      return {
        version: data[0],
        flags: new Uint8Array(data.subarray(1, 4)),
        dataReferences: muxjs.inspectMp4(data.subarray(8))
      };
    },
    hdlr: function(data) {
      var
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        language,
        result = {
          version: view.getUint8(0),
          flags: new Uint8Array(data.subarray(1, 4)),
          handlerType: parseType(data.subarray(8, 12)),
          name: ''
        },
        i = 8;

      // parse out the name field
      for (i = 24; i < data.byteLength; i++) {
        if (data[i] === 0x00) {
          // the name field is null-terminated
          i++;
          break;
        }
        result.name += String.fromCharCode(data[i]);
      }
      // decode UTF-8 to javascript's internal representation
      // see http://ecmanaut.blogspot.com/2006/07/encoding-decoding-utf8-in-javascript.html
      result.name = window.decodeURIComponent(window.escape(result.name));

      return result;
    },
    mdat: function(data) {
      return {
        byteLength: data.byteLength,
        nals: nalParse(data)
      };
    },
    mdhd: function(data) {
      var
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        i = 4,
        language,
        result = {
          version: view.getUint8(0),
          flags: new Uint8Array(data.subarray(1, 4)),
          language: ''
        };
      if (result.version === 1) {
        i += 4;
        result.creationTime = parseMp4Date(view.getUint32(i)); // truncating top 4 bytes
        i += 8;
        result.modificationTime = parseMp4Date(view.getUint32(i)); // truncating top 4 bytes
        i += 4;
        result.timescale = view.getUint32(i);
        i += 8;
        result.duration = view.getUint32(i); // truncating top 4 bytes
      } else {
        result.creationTime = parseMp4Date(view.getUint32(i));
        i += 4;
        result.modificationTime = parseMp4Date(view.getUint32(i));
        i += 4;
        result.timescale = view.getUint32(i);
        i += 4;
        result.duration = view.getUint32(i);
      }
      i += 4;
      // language is stored as an ISO-639-2/T code in an array of three 5-bit fields
      // each field is the packed difference between its ASCII value and 0x60
      language = view.getUint16(i);
      result.language += String.fromCharCode((language >> 10) + 0x60);
      result.language += String.fromCharCode(((language & 0x03c0) >> 5) + 0x60);
      result.language += String.fromCharCode((language & 0x1f) + 0x60);

      return result;
    },
    mdia: function(data) {
      return {
        boxes: muxjs.inspectMp4(data)
      };
    },
    mfhd: function(data) {
      return {
        version: data[0],
        flags: new Uint8Array(data.subarray(1, 4)),
        sequenceNumber: (data[4] << 24) |
          (data[5] << 16) |
          (data[6] << 8) |
          (data[7])
      };
    },
    minf: function(data) {
      return {
        boxes: muxjs.inspectMp4(data)
      };
    },
    // codingname, not a first-class box type. stsd entries share the
    // same format as real boxes so the parsing infrastructure can be
    // shared
    mp4a: function(data) {
      var
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        result = {
          // 6 bytes reserved
          dataReferenceIndex: view.getUint16(6),
          // 4 + 4 bytes reserved
          channelcount: view.getUint16(16),
          samplesize: view.getUint16(18),
          // 2 bytes pre_defined
          // 2 bytes reserved
          samplerate: view.getUint16(24) + (view.getUint16(26) / 65536)
        };

      // if there are more bytes to process, assume this is an ISO/IEC
      // 14496-14 MP4AudioSampleEntry and parse the ESDBox
      if (data.byteLength > 28) {
        result.streamDescriptor = muxjs.inspectMp4(data.subarray(28))[0];
      }
      return result;
    },
    moof: function(data) {
      return {
        boxes: muxjs.inspectMp4(data)
      };
    },
    moov: function(data) {
      return {
        boxes: muxjs.inspectMp4(data)
      };
    },
    mvex: function(data) {
      return {
        boxes: muxjs.inspectMp4(data)
      };
    },
    mvhd: function(data) {
      var
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        i = 4,
        result = {
          version: view.getUint8(0),
          flags: new Uint8Array(data.subarray(1, 4))
        };

      if (result.version === 1) {
        i += 4;
        result.creationTime = parseMp4Date(view.getUint32(i)); // truncating top 4 bytes
        i += 8;
        result.modificationTime = parseMp4Date(view.getUint32(i)); // truncating top 4 bytes
        i += 4;
        result.timescale = view.getUint32(i);
        i += 8
        result.duration = view.getUint32(i); // truncating top 4 bytes
      } else {
        result.creationTime = parseMp4Date(view.getUint32(i));
        i += 4;
        result.modificationTime = parseMp4Date(view.getUint32(i));
        i += 4;
        result.timescale = view.getUint32(i);
        i += 4;
        result.duration = view.getUint32(i);
      }
      i += 4;

      // convert fixed-point, base 16 back to a number
      result.rate = view.getUint16(i) + (view.getUint16(i + 2) / 16);
      i += 4;
      result.volume = view.getUint8(i) + (view.getUint8(i + 1) / 8);
      i += 2;
      i += 2;
      i += 2 * 4;
      result.matrix = new Uint32Array(data.subarray(i, i + (9 * 4)));
      i += 9 * 4;
      i += 6 * 4;
      result.nextTrackId = view.getUint32(i);
      return result;
    },
    pdin: function(data) {
      var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      return {
        version: view.getUint8(0),
        flags: new Uint8Array(data.subarray(1, 4)),
        rate: view.getUint32(4),
        initialDelay: view.getUint32(8)
      };
    },
    sdtp: function(data) {
      var
        result = {
          version: data[0],
          flags: new Uint8Array(data.subarray(1, 4)),
          samples: []
        }, i;

      for (i = 4; i < data.byteLength; i++) {
        result.samples.push({
          dependsOn: (data[i] & 0x30) >> 4,
          isDependedOn: (data[i] & 0x0c) >> 2,
          hasRedundancy: data[i] & 0x03
        });
      }
      return result;
    },
    sidx: function(data) {
      var view = new DataView(data.buffer, data.byteOffset, data.byteLength),
          result = {
            version: data[0],
            flags: new Uint8Array(data.subarray(1, 4)),
            references: [],
            referenceId: view.getUint32(4),
            timescale: view.getUint32(8),
            earliestPresentationTime: view.getUint32(12),
            firstOffset: view.getUint32(16)
          },
          referenceCount = view.getUint16(22),
          i;

      for (i = 24; referenceCount; i += 12, referenceCount-- ) {
        result.references.push({
          referenceType: (data[i] & 0x80) >>> 7,
          referencedSize: view.getUint32(i) & 0x7FFFFFFF,
          subsegmentDuration: view.getUint32(i + 4),
          startsWithSap: !!(data[i + 8] & 0x80),
          sapType: (data[i + 8] & 0x70) >>> 4,
          sapDeltaTime: view.getUint32(i + 8) & 0x0FFFFFFF
        });
      }

      return result;
    },
    smhd: function(data) {
      return {
        version: data[0],
        flags: new Uint8Array(data.subarray(1, 4)),
        balance: data[4] + (data[5] / 256)
      };
    },
    stbl: function(data) {
      return {
        boxes: muxjs.inspectMp4(data)
      };
    },
    stco: function(data) {
      var
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        result = {
          version: data[0],
          flags: new Uint8Array(data.subarray(1, 4)),
          chunkOffsets: []
        },
        entryCount = view.getUint32(4),
        i;
      for (i = 8; entryCount; i += 4, entryCount--) {
        result.chunkOffsets.push(view.getUint32(i));
      }
      return result;
    },
    stsc: function(data) {
      var
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        entryCount = view.getUint32(4),
        result = {
          version: data[0],
          flags: new Uint8Array(data.subarray(1, 4)),
          sampleToChunks: []
        },
        i;
      for (i = 8; entryCount; i += 12, entryCount--) {
        result.sampleToChunks.push({
          firstChunk: view.getUint32(i),
          samplesPerChunk: view.getUint32(i + 4),
          sampleDescriptionIndex: view.getUint32(i + 8)
        });
      }
      return result;
    },
    stsd: function(data) {
      return {
        version: data[0],
        flags: new Uint8Array(data.subarray(1, 4)),
        sampleDescriptions: muxjs.inspectMp4(data.subarray(8))
      };
    },
    stsz: function(data) {
      var
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        result = {
          version: data[0],
          flags: new Uint8Array(data.subarray(1, 4)),
          sampleSize: view.getUint32(4),
          entries: []
        },
        i;
      for (i = 12; i < data.byteLength; i += 4) {
        result.entries.push(view.getUint32(i));
      }
      return result;
    },
    stts: function(data) {
      var
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        result = {
          version: data[0],
          flags: new Uint8Array(data.subarray(1, 4)),
          timeToSamples: []
        },
        entryCount = view.getUint32(4),
        i;

      for (i = 8; entryCount; i += 8, entryCount--) {
        result.timeToSamples.push({
          sampleCount: view.getUint32(i),
          sampleDelta: view.getUint32(i + 4)
        });
      }
      return result;
    },
    styp: function(data) {
      return parse.ftyp(data);
    },
    tfdt: function(data) {
      return {
        version: data[0],
        flags: new Uint8Array(data.subarray(1, 4)),
        baseMediaDecodeTime: data[4] << 24 | data[5] << 16 | data[6] << 8 | data[7]
      };
    },
    tfhd: function(data) {
      var
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        result = {
          version: data[0],
          flags: new Uint8Array(data.subarray(1, 4)),
          trackId: view.getUint32(4)
        },
        baseDataOffsetPresent = result.flags[2] & 0x01,
        sampleDescriptionIndexPresent = result.flags[2] & 0x02,
        defaultSampleDurationPresent = result.flags[2] & 0x08,
        defaultSampleSizePresent = result.flags[2] & 0x10,
        defaultSampleFlagsPresent = result.flags[2] & 0x20,
        i;

      i = 8;
      if (baseDataOffsetPresent) {
        i += 4; // truncate top 4 bytes
        result.baseDataOffset = view.getUint32(12);
        i += 4;
      }
      if (sampleDescriptionIndexPresent) {
        result.sampleDescriptionIndex = view.getUint32(i);
        i += 4;
      }
      if (defaultSampleDurationPresent) {
        result.defaultSampleDuration = view.getUint32(i);
        i += 4;
      }
      if (defaultSampleSizePresent) {
        result.defaultSampleSize = view.getUint32(i);
        i += 4;
      }
      if (defaultSampleFlagsPresent) {
        result.defaultSampleFlags = view.getUint32(i);
      }
      return result;
    },
    tkhd: function(data) {
      var
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        i = 4,
        result = {
          version: view.getUint8(0),
          flags: new Uint8Array(data.subarray(1, 4)),
        };
      if (result.version === 1) {
        i += 4;
        result.creationTime = parseMp4Date(view.getUint32(i)); // truncating top 4 bytes
        i += 8;
        result.modificationTime = parseMp4Date(view.getUint32(i)); // truncating top 4 bytes
        i += 4;
        result.trackId = view.getUint32(i);
        i += 4;
        i += 8;
        result.duration = view.getUint32(i); // truncating top 4 bytes
      } else {
        result.creationTime = parseMp4Date(view.getUint32(i));
        i += 4;
        result.modificationTime = parseMp4Date(view.getUint32(i));
        i += 4;
        result.trackId = view.getUint32(i);
        i += 4;
        i += 4;
        result.duration = view.getUint32(i);
      }
      i += 4;
      i += 2 * 4;
      result.layer = view.getUint16(i);
      i += 2;
      result.alternateGroup = view.getUint16(i);
      i += 2;
      // convert fixed-point, base 16 back to a number
      result.volume = view.getUint8(i) + (view.getUint8(i + 1) / 8);
      i += 2;
      i += 2;
      result.matrix = new Uint32Array(data.subarray(i, i + (9 * 4)));
      i += 9 * 4;
      result.width = view.getUint16(i) + (view.getUint16(i + 2) / 16);
      i += 4;
      result.height = view.getUint16(i) + (view.getUint16(i + 2) / 16);
      return result;
    },
    traf: function(data) {
      return {
        boxes: muxjs.inspectMp4(data)
      };
    },
    trak: function(data) {
      return {
        boxes: muxjs.inspectMp4(data)
      };
    },
    trex: function(data) {
      var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      return {
        version: data[0],
        flags: new Uint8Array(data.subarray(1, 4)),
        trackId: view.getUint32(4),
        defaultSampleDescriptionIndex: view.getUint32(8),
        defaultSampleDuration: view.getUint32(12),
        defaultSampleSize: view.getUint32(16),
        sampleDependsOn: data[20] & 0x03,
        sampleIsDependedOn: (data[21] & 0xc0) >> 6,
        sampleHasRedundancy: (data[21] & 0x30) >> 4,
        samplePaddingValue: (data[21] & 0x0e) >> 1,
        sampleIsDifferenceSample: !!(data[21] & 0x01),
        sampleDegradationPriority: view.getUint16(22)
      };
    },
    trun: function(data) {
      var
        result = {
          version: data[0],
          flags: new Uint8Array(data.subarray(1, 4)),
          samples: []
        },
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        dataOffsetPresent = result.flags[2] & 0x01,
        firstSampleFlagsPresent = result.flags[2] & 0x04,
        sampleDurationPresent = result.flags[1] & 0x01,
        sampleSizePresent = result.flags[1] & 0x02,
        sampleFlagsPresent = result.flags[1] & 0x04,
        sampleCompositionTimeOffsetPresent = result.flags[1] & 0x08,
        sampleCount = view.getUint32(4),
        offset = 8,
        sample;

      if (dataOffsetPresent) {
        result.dataOffset = view.getUint32(offset);
        offset += 4;
      }
      if (firstSampleFlagsPresent && sampleCount) {
        sample = {
          flags: parseSampleFlags(data.subarray(offset, offset + 4))
        };
        offset += 4;
        if (sampleDurationPresent) {
          sample.duration = view.getUint32(offset);
          offset += 4;
        }
        if (sampleSizePresent) {
          sample.size = view.getUint32(offset);
          offset += 4;
        }
        if (sampleCompositionTimeOffsetPresent) {
          sample.compositionTimeOffset = view.getUint32(offset);
          offset += 4;
        }
        result.samples.push(sample);
        sampleCount--;
      };
      while (sampleCount--) {
        sample = {};
        if (sampleDurationPresent) {
          sample.duration = view.getUint32(offset);
          offset += 4;
        }
        if (sampleSizePresent) {
          sample.size = view.getUint32(offset);
          offset += 4;
        }
        if (sampleFlagsPresent) {
          sample.flags = parseSampleFlags(data.subarray(offset, offset + 4));
          offset += 4;
        }
        if (sampleCompositionTimeOffsetPresent) {
          sample.compositionTimeOffset = view.getUint32(offset);
          offset += 4;
        }
        result.samples.push(sample);
      }
      return result;
    },
    'url ': function(data) {
      return {
        version: data[0],
        flags: new Uint8Array(data.subarray(1, 4))
      };
    },
    vmhd: function(data) {
      var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      return {
        version: data[0],
        flags: new Uint8Array(data.subarray(1, 4)),
        graphicsmode: view.getUint16(4),
        opcolor: new Uint16Array([view.getUint16(6),
                                  view.getUint16(8),
                                  view.getUint16(10)])
      };
    }
  };

/**
 * Return a javascript array of box objects parsed from an ISO base
 * media file.
 * @param data {Uint8Array} the binary data of the media to be inspected
 * @return {array} a javascript array of potentially nested box objects
 */
muxjs.inspectMp4 = function(data) {
  var
    i = 0,
    result = [],
    view = new DataView(data.buffer, data.byteOffset, data.byteLength),
    size,
    type,
    end,
    box;

  while (i < data.byteLength) {
    // parse box data
    size = view.getUint32(i),
    type =  parseType(data.subarray(i + 4, i + 8));
    end = size > 1 ? i + size : data.byteLength;

    // parse type-specific data
    box = (parse[type] || function(data) {
      return {
        data: data
      };
    })(data.subarray(i + 8, end));
    box.size = size;
    box.type = type;

    // store this box and move to the next
    result.push(box);
    i = end;
  }
  return result;
};

/**
 * Returns a textual representation of the javascript represtentation
 * of an MP4 file. You can use it as an alternative to
 * JSON.stringify() to compare inspected MP4s.
 * @param inspectedMp4 {array} the parsed array of boxes in an MP4
 * file
 * @param depth {number} (optional) the number of ancestor boxes of
 * the elements of inspectedMp4. Assumed to be zero if unspecified.
 * @return {string} a text representation of the parsed MP4
 */
muxjs.textifyMp4 = function(inspectedMp4, depth) {
  var indent;
  depth = depth || 0;
  indent = Array(depth * 2 + 1).join(' ');

  // iterate over all the boxes
  return inspectedMp4.map(function(box, index) {

    // list the box type first at the current indentation level
    return indent + box.type + '\n' +

      // the type is already included and handle child boxes separately
      Object.keys(box).filter(function(key) {
        return key !== 'type' && key !== 'boxes';

      // output all the box properties
      }).map(function(key) {
        var prefix = indent + '  ' + key + ': ',
            value = box[key];

        // print out raw bytes as hexademical
        if (value instanceof Uint8Array || value instanceof Uint32Array) {
          var bytes = Array.prototype.slice.call(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
              .map(function(byte) {
                return ' ' + ('00' + byte.toString(16)).slice(-2);
              }).join('').match(/.{1,24}/g);
          if (!bytes) {
            return prefix + '<>';
          }
          if (bytes.length === 1) {
            return prefix + '<' + bytes.join('').slice(1) + '>';
          }
          return prefix + '<\n' + bytes.map(function(line) {
            return indent + '  ' + line;
          }).join('\n') + '\n' + indent + '  >';
        }

        // stringify generic objects
        return prefix +
            JSON.stringify(value, null, 2)
              .split('\n').map(function(line, index) {
                if (index === 0) {
                  return line;
                }
                return indent + '  ' + line;
              }).join('\n');
      }).join('\n') +

    // recursively textify the child boxes
    (box.boxes ? '\n' + muxjs.textifyMp4(box.boxes, depth + 1) : '');
  }).join('\n');
};

})(window, window.muxjs);
