import {
	DEFAULT_SUPPORTED_MEDIA_TYPE_LIST,
	Editor,
	TLShapeId,
	useMaybeEditor,
	useShallowArrayIdentity,
} from '@tldraw/editor'
import { createContext, useCallback, useContext, useEffect, useRef } from 'react'

export const MimeTypeContext = createContext<string[] | undefined>([])

export function useInsertMedia({ shapeIdToReplace }: { shapeIdToReplace?: TLShapeId } = {}) {
	const _editor = useMaybeEditor()
	const inputRef = useRef<HTMLInputElement>()
	const mimeTypes = useShallowArrayIdentity(useContext(MimeTypeContext))

	useEffect(() => {
		const editor = _editor as Editor
		if (!editor) return

		const input = document.createElement('input')
		input.type = 'file'
		input.accept = mimeTypes?.join(',') ?? DEFAULT_SUPPORTED_MEDIA_TYPE_LIST
		input.multiple = !shapeIdToReplace
		inputRef.current = input

		async function onchange(e: Event) {
			const fileList = (e.target as HTMLInputElement).files
			if (!fileList || fileList.length === 0) return
			editor.markHistoryStoppingPoint('insert media')
			await editor.putExternalContent({
				type: 'files',
				files: Array.from(fileList),
				point: editor.getViewportPageBounds().center,
				ignoreParent: false,
				shapeIdToReplace,
			})
			input.value = ''
		}

		input.addEventListener('change', onchange)

		return () => {
			inputRef.current = undefined
			input.removeEventListener('change', onchange)
		}
	}, [_editor, shapeIdToReplace, mimeTypes])

	return useCallback(() => {
		inputRef.current?.click()
	}, [inputRef])
}
