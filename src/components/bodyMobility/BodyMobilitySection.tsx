import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  SIDE_MOBILITY_JOINT_KEYS,
  pickSharedHeadReading,
  type BodySide,
  type MobilityJointKey,
  type SideMobilityReadings,
} from '../../lib/bodyMobility'
import { BodyMobilityGaugeCard } from './BodyMobilityGaugeCard'

const HEAD_EMBLEM = require('../../../assets/aicoachflow/head.png')
const SHOULDER_EMBLEM = require('../../../assets/aicoachflow/shoulder.png')
const WRIST_EMBLEM = require('../../../assets/aicoachflow/wrist.png')
const KNEE_EMBLEM = require('../../../assets/aicoachflow/knee.png')

const EMBLEMS: Record<MobilityJointKey, number> = {
  head: HEAD_EMBLEM,
  shoulder: SHOULDER_EMBLEM,
  wrist: WRIST_EMBLEM,
  knee: KNEE_EMBLEM,
}

export type BodyMobilityPayload = {
  frame: number
  totalFrames?: number
  side: {
    LEFT: SideMobilityReadings
    RIGHT: SideMobilityReadings
  }
  idealSource: { trainSampleId: string; strokeLabel: string } | null
}

export type BodyMobilitySectionProps = {
  data: BodyMobilityPayload | null
}

export function BodyMobilitySection({ data }: BodyMobilitySectionProps) {
  const { t } = useTranslation()
  const [side, setSide] = useState<BodySide>('RIGHT')
  const styles = useMemo(() => getStyles(), [])

  if (!data?.side) return null

  const readings = data.side[side]
  const sharedHead = pickSharedHeadReading(data.side.LEFT, data.side.RIGHT)

  return (
    <View style={styles.wrap}>
      <BodyMobilityGaugeCard
        joint="head"
        reading={sharedHead.reading}
        side={null}
        emblem={EMBLEMS.head}
      />

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, side === 'RIGHT' && styles.tabActive]}
          onPress={() => setSide('RIGHT')}
          activeOpacity={0.85}
        >
          <Text
            allowFontScaling={false}
            style={[styles.tabText, side === 'RIGHT' && styles.tabTextActive]}
          >
            {t('technique.bodyMobilityRightTab')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, side === 'LEFT' && styles.tabActive]}
          onPress={() => setSide('LEFT')}
          activeOpacity={0.85}
        >
          <Text
            allowFontScaling={false}
            style={[styles.tabText, side === 'LEFT' && styles.tabTextActive]}
          >
            {t('technique.bodyMobilityLeftTab')}
          </Text>
        </TouchableOpacity>
      </View>

      {SIDE_MOBILITY_JOINT_KEYS.map((joint) => (
        <BodyMobilityGaugeCard
          key={`${side}-${joint}`}
          joint={joint}
          reading={readings[joint]}
          side={side}
          emblem={EMBLEMS[joint]}
        />
      ))}
    </View>
  )
}

function getStyles() {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      marginTop: 14,
      marginBottom: 4,
    },
    tabs: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    tabActive: {
      backgroundColor: 'rgba(0, 184, 255, 0.18)',
      borderColor: 'rgba(0, 184, 255, 0.45)',
    },
    tabText: {
      color: 'rgba(255,255,255,0.55)',
      fontSize: 14,
      fontWeight: '600',
    },
    tabTextActive: {
      color: '#00B8FF',
    },
  })
}
