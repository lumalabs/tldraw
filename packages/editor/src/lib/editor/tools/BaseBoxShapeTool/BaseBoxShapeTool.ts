import { TLShape } from '@tldraw/tlschema'
import { StateNode, TLStateNodeConstructor } from '../StateNode'
import { Idle } from './children/Idle'
import { Pointing } from './children/Pointing'
import { TLBaseBoxShape } from '../../shapes/BaseBoxShapeUtil'

/** @public */
export abstract class BaseBoxShapeTool extends StateNode { // <T extends TLBaseBoxShape = TLBaseBoxShape>
	static override id = 'box'
	static override initial = 'idle'
	static override children(): TLStateNodeConstructor[] {
		return [Idle, Pointing]
	}

	abstract override shapeType: TLBaseBoxShape['type']

	onCreate?(_shape: TLShape | null): void | null // TODO: shouldn't this use TLBaseBoxShape instead of TLShape?
}
