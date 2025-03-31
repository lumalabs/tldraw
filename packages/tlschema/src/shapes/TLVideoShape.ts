import { T } from '@tldraw/validate'
import { assetIdValidator } from '../assets/TLBaseAsset'
import { TLAssetId } from '../records/TLAsset'
import { createShapePropsMigrationIds, createShapePropsMigrationSequence } from '../records/TLShape'
import { RecordProps } from '../recordsWithProps'
import {
	DefaultColorStyle,
	DefaultLabelColorStyle,
	TLDefaultColorStyle,
} from '../styles/TLColorStyle'
import { DefaultFillStyle, TLDefaultFillStyle } from '../styles/TLFillStyle'
import { DefaultFontStyle, TLDefaultFontStyle } from '../styles/TLFontStyle'
import {
	DefaultHorizontalAlignStyle,
	TLDefaultHorizontalAlignStyle,
} from '../styles/TLHorizontalAlignStyle'
import { DefaultSizeStyle, TLDefaultSizeStyle } from '../styles/TLSizeStyle'
import {
	DefaultVerticalAlignStyle,
	TLDefaultVerticalAlignStyle,
} from '../styles/TLVerticalAlignStyle'
import { TLBaseShape } from './TLBaseShape'

/** @public */
export interface TLVideoShapeProps {
	w: number
	h: number
	time: number
	playing: boolean
	url: string
	assetId: TLAssetId | null

	// Text properties
	labelColor: TLDefaultColorStyle
	color: TLDefaultColorStyle
	fill: TLDefaultFillStyle
	size: TLDefaultSizeStyle
	font: TLDefaultFontStyle
	align: TLDefaultHorizontalAlignStyle
	verticalAlign: TLDefaultVerticalAlignStyle
	text: string
	altText: string
}

/** @public */
export type TLVideoShape = TLBaseShape<'video', TLVideoShapeProps>

/** @public */
export const videoShapeProps: RecordProps<TLVideoShape> = {
	w: T.nonZeroNumber,
	h: T.nonZeroNumber,
	time: T.number,
	playing: T.boolean,
	url: T.linkUrl,
	assetId: assetIdValidator.nullable(),

	// Text properties
	labelColor: DefaultLabelColorStyle,
	color: DefaultColorStyle,
	fill: DefaultFillStyle,
	size: DefaultSizeStyle,
	font: DefaultFontStyle,
	align: DefaultHorizontalAlignStyle,
	verticalAlign: DefaultVerticalAlignStyle,
	text: T.string,
	altText: T.string,
}

const Versions = createShapePropsMigrationIds('video', {
	AddUrlProp: 1,
	MakeUrlsValid: 2,
	AddTextProps: 3,
	AddAltText: 4,
})

export { Versions as videoShapeVersions }

/** @public */
export const videoShapeMigrations = createShapePropsMigrationSequence({
	sequence: [
		{
			id: Versions.AddUrlProp,
			up: (props) => {
				props.url = ''
			},
			down: 'retired',
		},
		{
			id: Versions.MakeUrlsValid,
			up: (props) => {
				if (!T.linkUrl.isValid(props.url)) {
					props.url = ''
				}
			},
			down: (_props) => {
				// noop
			},
		},
		{
			id: Versions.AddTextProps,
			up: (props) => {
				props.color = 'black'
				props.labelColor = 'black'
				props.fill = 'none'
				props.size = 'm'
				props.font = 'draw'
				props.text = ''
				props.align = 'middle'
				props.verticalAlign = 'middle'
			},
			down: (props) => {
				delete props.labelColor
				delete props.color
				delete props.fill
				delete props.size
				delete props.font
				delete props.align
				delete props.verticalAlign
				delete props.text
			},
		},
		{
			id: Versions.AddAltText,
			up: (props) => {
				props.altText = ''
			},
			down: (props) => {
				delete props.altText
			},
		},
	],
})
