import { promiseWithResolve } from '../control'
import { Image } from '../network'
import { isApngAnimated } from './apng'
import { isAvifAnimated } from './avif'
import { isGifAnimated } from './gif'
import { PngHelpers } from './png'
import { isWebpAnimated } from './webp'

/** @public */
export const DEFAULT_SUPPORTED_VECTOR_IMAGE_TYPES = Object.freeze(['image/svg+xml' as const])
/** @public */
export const DEFAULT_SUPPORTED_STATIC_IMAGE_TYPES = Object.freeze([
	'image/jpeg' as const,
	'image/png' as const,
	'image/webp' as const,
])
/** @public */
export const DEFAULT_SUPPORTED_ANIMATED_IMAGE_TYPES = Object.freeze([
	'image/gif' as const,
	'image/apng' as const,
	'image/avif' as const,
])
/** @public */
export const DEFAULT_SUPPORTED_IMAGE_TYPES = Object.freeze([
	...DEFAULT_SUPPORTED_STATIC_IMAGE_TYPES,
	...DEFAULT_SUPPORTED_VECTOR_IMAGE_TYPES,
	...DEFAULT_SUPPORTED_ANIMATED_IMAGE_TYPES,
])
/** @public */
export const DEFAULT_SUPPORT_VIDEO_TYPES = Object.freeze([
	'video/mp4' as const,
	'video/webm' as const,
	'video/quicktime' as const,
])
/** @public */
export const DEFAULT_SUPPORT_AUDIO_TYPES = Object.freeze([
	'audio/webm' as const,
	'audio/ogg' as const,
	'audio/mp3' as const,
	'audio/mp4' as const,
	'audio/mpeg' as const,
	'audio/aac' as const,
	'audio/flac' as const,
	'audio/wav' as const,
	'audio/x-wav' as const,
	'audio/x-m4a' as const,
])
/** @public */
export const DEFAULT_SUPPORTED_MEDIA_TYPES = Object.freeze([
	...DEFAULT_SUPPORTED_IMAGE_TYPES,
	...DEFAULT_SUPPORT_VIDEO_TYPES,
	...DEFAULT_SUPPORT_AUDIO_TYPES,
])
/** @public */
export const DEFAULT_SUPPORTED_MEDIA_TYPE_LIST = DEFAULT_SUPPORTED_MEDIA_TYPES.join(',')

/**
 * Helpers for media
 *
 * @public
 */
export class MediaHelpers {
	/**
	 * Load a video from a url.
	 * @public
	 */
	static loadVideo(src: string): Promise<HTMLVideoElement> {
		return new Promise((resolve, reject) => {
			const video = document.createElement('video')
			video.onloadeddata = () => resolve(video)
			video.onerror = (e) => {
				console.error(e)
				reject(new Error('Could not load video'))
			}
			video.crossOrigin = 'anonymous'
			video.src = src
		})
	}

	static async getVideoFrameAsDataUrl(video: HTMLVideoElement, time = 0): Promise<string> {
		const promise = promiseWithResolve<string>()
		let didSetTime = false

		const onReadyStateChanged = () => {
			if (!didSetTime) {
				if (video.readyState >= video.HAVE_METADATA) {
					didSetTime = true
					video.currentTime = time
				} else {
					return
				}
			}

			if (video.readyState >= video.HAVE_CURRENT_DATA) {
				const canvas = document.createElement('canvas')
				canvas.width = video.videoWidth
				canvas.height = video.videoHeight
				const ctx = canvas.getContext('2d')
				if (!ctx) {
					throw new Error('Could not get 2d context')
				}
				ctx.drawImage(video, 0, 0)
				promise.resolve(canvas.toDataURL())
			}
		}
		const onError = (e: Event) => {
			console.error(e)
			promise.reject(new Error('Could not get video frame'))
		}

		video.addEventListener('loadedmetadata', onReadyStateChanged)
		video.addEventListener('loadeddata', onReadyStateChanged)
		video.addEventListener('canplay', onReadyStateChanged)
		video.addEventListener('seeked', onReadyStateChanged)

		video.addEventListener('error', onError)
		video.addEventListener('stalled', onError)

		onReadyStateChanged()

		try {
			return await promise
		} finally {
			video.removeEventListener('loadedmetadata', onReadyStateChanged)
			video.removeEventListener('loadeddata', onReadyStateChanged)
			video.removeEventListener('canplay', onReadyStateChanged)
			video.removeEventListener('seeked', onReadyStateChanged)

			video.removeEventListener('error', onError)
			video.removeEventListener('stalled', onError)
		}
	}

	/**
	 * Load an audio file from a url.
	 * @public
	 */
	static loadAudio(src: string): Promise<HTMLAudioElement> {
		return new Promise((resolve, reject) => {
			const audio = document.createElement('audio')
			audio.onloadeddata = () => resolve(audio)
			audio.onerror = (e) => {
				console.error(e)
				reject(new Error('Could not load audio'))
			}
			audio.crossOrigin = 'anonymous'
			audio.src = src
		})
	}

	/**
	 * Load an image from a url.
	 * @public
	 */
	static getImageAndDimensions(
		src: string
	): Promise<{ w: number; h: number; image: HTMLImageElement }> {
		return new Promise((resolve, reject) => {
			const img = Image()
			img.onload = () => {
				let dimensions
				if (img.naturalWidth) {
					dimensions = {
						w: img.naturalWidth,
						h: img.naturalHeight,
					}
				} else {
					// Sigh, Firefox doesn't have naturalWidth or naturalHeight for SVGs. :-/
					// We have to attach to dom and use clientWidth/clientHeight.
					document.body.appendChild(img)
					dimensions = {
						w: img.clientWidth,
						h: img.clientHeight,
					}
					document.body.removeChild(img)
				}
				resolve({ ...dimensions, image: img })
			}
			img.onerror = (e) => {
				console.error(e)
				reject(new Error('Could not load image'))
			}
			img.crossOrigin = 'anonymous'
			img.referrerPolicy = 'strict-origin-when-cross-origin'
			img.style.visibility = 'hidden'
			img.style.position = 'absolute'
			img.style.opacity = '0'
			img.style.zIndex = '-9999'
			img.src = src
		})
	}

	/**
	 * Get the size of a video blob
	 *
	 * @param blob - A SharedBlob containing the video
	 * @public
	 */
	static async getVideoSize(blob: Blob): Promise<{ w: number; h: number }> {
		return MediaHelpers.usingObjectURL(blob, async (url) => {
			const video = await MediaHelpers.loadVideo(url)
			return { w: video.videoWidth, h: video.videoHeight }
		})
	}

	static async getAudioTags(blob: Blob): Promise<{ title: string; coverArt: string }> {
		// Load this dynamically to reduce bundle size.
		// @ts-ignore no types available currently.
		const jsmediatags = await import('jsmediatags-web')

		return new Promise((resolve) => {
			jsmediatags.read(blob, {
				onSuccess: function (mediaInfo: any) {
					const result = {
						title: '',
						coverArt: '',
					}
					if (mediaInfo.tags?.picture) {
						const { data, format } = mediaInfo.tags.picture
						const base64String = data.map((x: number) => String.fromCharCode(x)).join('')
						result.coverArt = `data:${format};base64,${window.btoa(base64String)}`
					}
					if (mediaInfo.tags?.title) {
						result.title = mediaInfo.tags.title
					}
					resolve(result)
				},
				onError: function (error: any) {
					console.error('Could not decode audio tags:', error.type, error.info)
					resolve({ title: '', coverArt: '' })
				},
			})
		})
	}

	/**
	 * Get the size of an image blob
	 *
	 * @param blob - A Blob containing the image.
	 * @public
	 */
	static async getImageSize(blob: Blob): Promise<{ w: number; h: number }> {
		const { w, h } = await MediaHelpers.usingObjectURL(blob, MediaHelpers.getImageAndDimensions)

		try {
			if (blob.type === 'image/png') {
				const view = new DataView(await blob.arrayBuffer())
				if (PngHelpers.isPng(view, 0)) {
					const physChunk = PngHelpers.findChunk(view, 'pHYs')
					if (physChunk) {
						const physData = PngHelpers.parsePhys(view, physChunk.dataOffset)
						if (physData.unit === 0 && physData.ppux === physData.ppuy) {
							// Calculate pixels per meter:
							// - 1 inch = 0.0254 meters
							// - 72 DPI is 72 dots per inch
							// - pixels per meter = 72 / 0.0254
							const pixelsPerMeter = 72 / 0.0254
							const pixelRatio = Math.max(physData.ppux / pixelsPerMeter, 1)
							return {
								w: Math.round(w / pixelRatio),
								h: Math.round(h / pixelRatio),
							}
						}
					}
				}
			}
		} catch (err) {
			console.error(err)
			return { w, h }
		}
		return { w, h }
	}

	static async isAnimated(file: Blob): Promise<boolean> {
		if (file.type === 'image/gif') {
			return isGifAnimated(await file.arrayBuffer())
		}

		if (file.type === 'image/avif') {
			return isAvifAnimated(await file.arrayBuffer())
		}

		if (file.type === 'image/webp') {
			return isWebpAnimated(await file.arrayBuffer())
		}

		if (file.type === 'image/apng') {
			return isApngAnimated(await file.arrayBuffer())
		}

		return false
	}

	static isAnimatedImageType(mimeType: string | null): boolean {
		return DEFAULT_SUPPORTED_ANIMATED_IMAGE_TYPES.includes((mimeType as any) || '')
	}

	static isStaticImageType(mimeType: string | null): boolean {
		return DEFAULT_SUPPORTED_STATIC_IMAGE_TYPES.includes((mimeType as any) || '')
	}

	static isVectorImageType(mimeType: string | null): boolean {
		return DEFAULT_SUPPORTED_VECTOR_IMAGE_TYPES.includes((mimeType as any) || '')
	}

	static isImageType(mimeType: string): boolean {
		return DEFAULT_SUPPORTED_IMAGE_TYPES.includes((mimeType as any) || '')
	}

	static async usingObjectURL<T>(blob: Blob, fn: (url: string) => Promise<T>): Promise<T> {
		const url = URL.createObjectURL(blob)
		try {
			return await fn(url)
		} finally {
			URL.revokeObjectURL(url)
		}
	}
}
