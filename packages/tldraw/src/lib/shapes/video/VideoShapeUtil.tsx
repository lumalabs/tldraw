import {
	BaseBoxShapeUtil,
	Box,
	EMPTY_ARRAY,
	Group2d,
	HTMLContainer,
	MediaHelpers,
	Rectangle2d,
	SvgExportContext,
	TLAsset,
	TLVideoShape,
	WeakCache,
	getDefaultColorTheme,
	toDomPrecision,
	useEditor,
	useEditorComponents,
	useIsEditing,
	videoShapeMigrations,
	videoShapeProps,
} from '@tldraw/editor'
import classNames from 'classnames'
import { ReactEventHandler, memo, useCallback, useEffect, useRef, useState } from 'react'
import { BrokenAssetIcon } from '../shared/BrokenAssetIcon'
import { HyperlinkButton } from '../shared/HyperlinkButton'
import { PlainTextLabel } from '../shared/PlainTextLabel'
import { SvgTextLabel } from '../shared/SvgTextLabel'
import {
	FONT_FAMILIES,
	LABEL_FONT_SIZES,
	LABEL_PADDING,
	TEXT_PROPS,
} from '../shared/default-shape-constants'
import { DefaultFontFaces } from '../shared/defaultFonts'
import { useDefaultColorTheme } from '../shared/useDefaultColorTheme'
import { useImageOrVideoAsset } from '../shared/useImageOrVideoAsset'
import { usePrefersReducedMotion } from '../shared/usePrefersReducedMotion'

const videoSvgExportCache = new WeakCache<TLAsset, Promise<string | null>>()

/** @public */
export class VideoShapeUtil extends BaseBoxShapeUtil<TLVideoShape> {
	static override type = 'video' as const
	static override props = videoShapeProps
	static override migrations = videoShapeMigrations

	override canEdit() {
		return true
	}
	override isAspectRatioLocked() {
		return true
	}

	override getDefaultProps(): TLVideoShape['props'] {
		return {
			w: 100,
			h: 100,
			assetId: null,
			time: 0,
			playing: true,
			url: '',

			// Text properties
			color: 'black',
			labelColor: 'black',
			fill: 'none',
			size: 'm',
			font: 'draw',
			text: '',
			altText: '',
			align: 'middle',
			verticalAlign: 'middle',
		}
	}

	override getText(shape: TLVideoShape) {
		return shape.props.text
	}

	override getFontFaces(shape: TLVideoShape) {
		if (!shape.props.text) return EMPTY_ARRAY
		return [DefaultFontFaces[`tldraw_${shape.props.font}`].normal.normal]
	}

	override getGeometry(shape: TLVideoShape) {
		const children = [
			new Rectangle2d({
				width: shape.props.w,
				height: shape.props.h,
				isFilled: true,
			}),
		]

		if (shape.props.text) {
			const textDimensions = this.editor.textMeasure.measureText(shape.props.text, {
				...TEXT_PROPS,
				fontFamily: FONT_FAMILIES[shape.props.font],
				fontSize: LABEL_FONT_SIZES[shape.props.size],
				maxWidth: shape.props.w - LABEL_PADDING * 2,
			})

			children.push(
				new Rectangle2d({
					x: 0,
					y: shape.props.h + LABEL_PADDING,
					width: shape.props.w,
					height: textDimensions.h,
					isFilled: true,
					isLabel: true,
				})
			)
		}

		return new Group2d({ children })
	}

	component(shape: TLVideoShape) {
		return <VideoShape shape={shape} />
	}

	indicator(shape: TLVideoShape) {
		return <rect width={toDomPrecision(shape.props.w)} height={toDomPrecision(shape.props.h)} />
	}

	override async toSvg(shape: TLVideoShape, ctx: SvgExportContext) {
		const props = shape.props
		if (!props.assetId) return null

		const asset = this.editor.getAsset<TLAsset>(props.assetId)
		if (!asset) return null

		const src = await videoSvgExportCache.get(asset, async () => {
			const assetUrl = await ctx.resolveAssetUrl(asset.id, props.w)
			if (!assetUrl) return null
			const video = await MediaHelpers.loadVideo(assetUrl)
			return await MediaHelpers.getVideoFrameAsDataUrl(video, 0)
		})

		if (!src) return null

		let textEl
		if (props.text) {
			const theme = getDefaultColorTheme(ctx)

			const textDimensions = this.editor.textMeasure.measureText(props.text, {
				...TEXT_PROPS,
				fontFamily: FONT_FAMILIES[props.font],
				fontSize: LABEL_FONT_SIZES[props.size],
				maxWidth: props.w - LABEL_PADDING * 2,
			})
			const bounds = new Box(0, props.h + LABEL_PADDING, props.w, textDimensions.h)
			textEl = (
				<SvgTextLabel
					fontSize={LABEL_FONT_SIZES[props.size]}
					font={props.font}
					align={props.align}
					verticalAlign={props.verticalAlign}
					text={props.text}
					labelColor={theme[props.labelColor].solid}
					bounds={bounds}
					padding={LABEL_PADDING}
				/>
			)
		}

		return (
			<>
				<image href={src} width={props.w} height={props.h} />
				{textEl}
			</>
		)
	}
}

const VideoShape = memo(function VideoShape({ shape }: { shape: TLVideoShape }) {
	const editor = useEditor()
	const showControls = editor.getShapeGeometry(shape).bounds.w * editor.getZoomLevel() >= 110
	const isEditing = useIsEditing(shape.id)
	const prefersReducedMotion = usePrefersReducedMotion()
	const { Spinner } = useEditorComponents()
	const theme = useDefaultColorTheme()

	const { asset, url } = useImageOrVideoAsset({
		shapeId: shape.id,
		assetId: shape.props.assetId,
		width: shape.props.w,
	})

	const rVideo = useRef<HTMLVideoElement>(null!)

	const [isLoaded, setIsLoaded] = useState(false)

	const [isFullscreen, setIsFullscreen] = useState(false)

	useEffect(() => {
		const fullscreenChange = () => setIsFullscreen(document.fullscreenElement === rVideo.current)
		document.addEventListener('fullscreenchange', fullscreenChange)

		return () => document.removeEventListener('fullscreenchange', fullscreenChange)
	})

	const handleLoadedData = useCallback<ReactEventHandler<HTMLVideoElement>>((e) => {
		const video = e.currentTarget
		if (!video) return

		setIsLoaded(true)
	}, [])

	useEffect(() => {
		if (prefersReducedMotion) {
			const video = rVideo.current
			if (!video) return
			video.pause()
			video.currentTime = 0
		}
	}, [rVideo, prefersReducedMotion])

	const { fill, font, align, verticalAlign, size, text, color: labelColor } = shape.props
	const isSelected = shape.id === editor.getOnlySelectedShapeId()

	return (
		<>
			<HTMLContainer
				id={shape.id}
				style={{
					color: 'var(--color-text-3)',
					backgroundColor: asset ? 'transparent' : 'var(--color-low)',
					border: asset ? 'none' : '1px solid var(--color-low-border)',
				}}
			>
				<div className="tl-counter-scaled">
					<div className="tl-video-container">
						{!asset ? (
							<BrokenAssetIcon />
						) : Spinner && !asset.props.src ? (
							<Spinner />
						) : url ? (
							<>
								<video
									ref={rVideo}
									style={
										isEditing
											? { pointerEvents: 'all' }
											: !isLoaded
												? { display: 'none' }
												: undefined
									}
									className={classNames('tl-video', `tl-video-shape-${shape.id.split(':')[1]}`, {
										'tl-video-is-fullscreen': isFullscreen,
									})}
									width="100%"
									height="100%"
									draggable={false}
									playsInline
									autoPlay
									muted
									loop
									disableRemotePlayback
									disablePictureInPicture
									controls={isEditing && showControls}
									onLoadedData={handleLoadedData}
									hidden={!isLoaded}
								>
									<source src={url} />
								</video>
								{!isLoaded && Spinner && <Spinner />}
							</>
						) : null}
					</div>
				</div>
			</HTMLContainer>
			{'url' in shape.props && shape.props.url && <HyperlinkButton url={shape.props.url} />}

			<PlainTextLabel
				shapeId={shape.id}
				type={shape.type}
				font={font}
				fontSize={LABEL_FONT_SIZES[size]}
				lineHeight={TEXT_PROPS.lineHeight}
				padding={LABEL_PADDING}
				fill={fill}
				align={align}
				verticalAlign={verticalAlign}
				text={text}
				isSelected={isSelected}
				labelColor={theme[labelColor].solid}
				wrap
			/>
		</>
	)
})
