import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Video, ResizeMode, type AVPlaybackStatus, type AVPlaybackStatusSuccess } from 'expo-av'
import Ionicons from '@expo/vector-icons/Ionicons'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { ProLibraryGradientFrame } from './ProLibraryGradientFrame'
import { proLibraryChrome } from '../theme/proLibraryChrome'

const SCRUB_TRACK_PLAYED = '#00B8FF'
const SCRUB_TRACK_REST = '#808080'

/** Re-seek the original only past this drift, so status updates do not fight playback. */
const SYNC_TOLERANCE_MS = 140

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export type CorrectionVideoCompareProps = {
  /** The athlete's own clip — shown left of the split. */
  originalUri: string
  /** The generated correction clip — shown right of the split. */
  correctedUri: string
  /** `key` for Video remount (e.g. analysis id). */
  videoKey: string
  width: number
  initialSplit?: number
}

/**
 * Before/after compare for the correction clip: two synced players behind a draggable split,
 * inside the same accent gradient board as the analysis video. The corrected clip is the
 * playback master; the original is nudged back into sync whenever it drifts.
 */
export function CorrectionVideoCompare({
  originalUri,
  correctedUri,
  videoKey,
  width,
  initialSplit = 0.5,
}: CorrectionVideoCompareProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const correctedRef = useRef<Video>(null)
  const originalRef = useRef<Video>(null)
  const [split, setSplit] = useState(clamp01(initialSplit))
  const [playback, setPlayback] = useState<AVPlaybackStatusSuccess | null>(null)
  const [aspect, setAspect] = useState<number | null>(null)

  const videoH = useMemo(
    () => Math.max(1, Math.ceil(width * (aspect ?? 9 / 16))),
    [width, aspect]
  )

  const handleStatus = useCallback((s: AVPlaybackStatus) => {
    if (!s.isLoaded) return
    setPlayback(s as AVPlaybackStatusSuccess)
    const master = s as AVPlaybackStatusSuccess
    const follower = originalRef.current
    if (!follower) return
    void follower
      .getStatusAsync()
      .then((f) => {
        if (!f.isLoaded) return
        const drift = Math.abs((f.positionMillis ?? 0) - (master.positionMillis ?? 0))
        if (drift > SYNC_TOLERANCE_MS) {
          void follower.setPositionAsync(master.positionMillis ?? 0)
        }
        if (master.isPlaying && !f.isPlaying) void follower.playAsync()
        if (!master.isPlaying && f.isPlaying) void follower.pauseAsync()
      })
      .catch(() => {})
  }, [])

  const isPlaying = playback?.isLoaded === true && playback.isPlaying === true
  const durationMs =
    playback?.isLoaded && playback.durationMillis ? playback.durationMillis : 1
  const positionMs =
    playback?.isLoaded && playback.positionMillis != null ? playback.positionMillis : 0
  const progress = clamp01(positionMs / durationMs)

  const togglePlay = useCallback(async () => {
    const master = correctedRef.current
    const follower = originalRef.current
    if (!master) return
    if (isPlaying) {
      await master.pauseAsync()
      await follower?.pauseAsync().catch(() => {})
    } else {
      await master.playAsync()
      await follower?.playAsync().catch(() => {})
    }
  }, [isPlaying])

  const onNaturalSize = useCallback(
    (ns: { width: number; height: number } | null | undefined) => {
      if (!ns || ns.width <= 0 || ns.height <= 0) return
      setAspect(ns.height / ns.width)
    },
    []
  )

  const styles = useMemo(
    () =>
      StyleSheet.create({
        outer: { width: '100%', alignItems: 'center' },
        column: { width, alignSelf: 'center' },
        labelRow: {
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        label: {
          fontFamily: theme.semiBoldFont,
          fontSize: 11,
          color: 'rgba(200, 215, 230, 0.72)',
        },
        frame: { width, alignSelf: 'center', marginBottom: 2 },
        shell: { width, backgroundColor: '#000', alignItems: 'center' },
        card: { position: 'relative', width, height: videoH, overflow: 'hidden' },
        fill: { position: 'absolute', left: 0, top: 0, width, height: videoH },
        beforeClip: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
        sliderTrack: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 56,
          alignItems: 'center',
          justifyContent: 'center',
        },
        dividerLine: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 2,
          backgroundColor: 'rgba(255,255,255,0.9)',
        },
        handle: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: 'rgba(0, 20, 53, 0.92)',
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.85)',
        },
        controls: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'stretch',
          marginTop: 10,
          paddingHorizontal: 4,
          paddingVertical: 8,
          gap: 10,
        },
        playHit: { padding: 4, flexShrink: 0 },
        trackWrap: { flex: 1, justifyContent: 'center', minHeight: 20 },
        trackBg: {
          height: 6,
          borderRadius: 3,
          backgroundColor: SCRUB_TRACK_REST,
          position: 'relative',
        },
        trackFill: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          borderTopLeftRadius: 3,
          borderBottomLeftRadius: 3,
          backgroundColor: SCRUB_TRACK_PLAYED,
        },
        thumb: {
          position: 'absolute',
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: SCRUB_TRACK_PLAYED,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          top: -4,
          marginLeft: -7,
        },
      }),
    [theme.semiBoldFont, width, videoH]
  )

  return (
    <View style={styles.outer} pointerEvents="box-none">
      <View style={styles.column} pointerEvents="box-none">
        <View style={styles.labelRow}>
          <Text allowFontScaling={false} style={styles.label}>
            {t('technique.current')}
          </Text>
          <Text allowFontScaling={false} style={styles.label}>
            {t('technique.corrected')}
          </Text>
        </View>

        <ProLibraryGradientFrame
          borderRadius={proLibraryChrome.radii.frameOuter}
          innerBorderRadius={proLibraryChrome.radii.frameInner}
          strokeWidth={Math.max(proLibraryChrome.frameStrokeWidth, 2)}
          gradientVariant="accent"
          innerShadow={false}
          innerStyle={{ backgroundColor: '#000000', padding: 0, overflow: 'hidden' }}
          style={styles.frame}
        >
          <View style={styles.shell}>
            <View
              style={styles.card}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => setSplit(clamp01(e.nativeEvent.locationX / width))}
              onResponderMove={(e) => setSplit(clamp01(e.nativeEvent.locationX / width))}
            >
              <Video
                key={`corrected-${videoKey}`}
                ref={correctedRef}
                source={{ uri: correctedUri }}
                style={styles.fill}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls={false}
                isLooping
                isMuted
                progressUpdateIntervalMillis={100}
                onReadyForDisplay={(e) => onNaturalSize(e.naturalSize)}
                onPlaybackStatusUpdate={handleStatus}
              />
              <View style={[styles.beforeClip, { width: Math.max(0, split * width) }]}>
                <Video
                  key={`original-${videoKey}`}
                  ref={originalRef}
                  source={{ uri: originalUri }}
                  style={styles.fill}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls={false}
                  isLooping
                  isMuted
                />
              </View>
              <View
                pointerEvents="none"
                style={[styles.sliderTrack, { left: split * width - 28 }]}
              >
                <View style={styles.dividerLine} />
                <View style={styles.handle}>
                  <FeatherIcon name="chevron-left" size={14} color="#fff" />
                  <FeatherIcon name="chevron-right" size={14} color="#fff" />
                </View>
              </View>
            </View>
          </View>
        </ProLibraryGradientFrame>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.playHit} onPress={togglePlay} hitSlop={12}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.trackWrap}>
            <View style={styles.trackBg}>
              <View
                style={[
                  styles.trackFill,
                  { width: `${progress * 100}%` },
                  progress >= 0.998 && {
                    borderTopRightRadius: 3,
                    borderBottomRightRadius: 3,
                  },
                ]}
              />
              <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
