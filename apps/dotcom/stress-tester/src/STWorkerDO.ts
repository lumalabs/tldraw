import { Z_PROTOCOL_VERSION, Zero } from '@tldraw/dotcom-shared'
import { Result, assert, assertExists, sleep, uniqueId } from '@tldraw/utils'
import { DurableObject } from 'cloudflare:workers'
import { STCoordinatorDO } from './STCoordinatorDO'
import { Environment } from './types'

const TIMEOUT = 10_000

export class STWorkerDO extends DurableObject<Environment> {
	coordinator: STCoordinatorDO
	public zero: Zero | null = null
	num_files: number
	shouldStop = false
	constructor(
		private state: DurableObjectState,
		env: Environment
	) {
		super(state, env)
		this.coordinator = env.ST_COORDINATOR.get(
			env.ST_COORDINATOR.idFromName('coordinator')
		) as any as STCoordinatorDO
		// this.num_files = this.state.storage.get('num_files') as number
		this.num_files = 0
	}

	debug(..._args: any[]) {
		// console.log('STWorkerDO', ...args)
	}

	async time<T>(operation: string, fn: () => Promise<T>): Promise<T> {
		const now = Date.now()
		const res = await Promise.race([
			fn().then(Result.ok).catch(Result.err),
			sleep(TIMEOUT).then(() => Result.err(new Error(`Timeout: ${operation}`))),
		])
		const duration = Date.now() - now
		this.coordinator.reportEvent({
			type: 'operation',
			operation,
			duration,
			error: !res.ok ? res.error?.stack : null,
			workerId: await this.getId(),
			id: uniqueId(),
		})
		if (res.ok) {
			return res.value
		} else {
			throw res.error
		}
	}

	async mutate(name: string, fn: (z: Zero['____mutators']) => Promise<void>) {
		assert(this.zero, 'zero not initialized')
		await this.time(name, async () => {
			return await this.zero?.sneakyTransaction(async () => {
				await fn(this.zero!.____mutators)
			})
		})
	}

	private async startWorking() {
		try {
			// this.debug('startWorking')
			const workerId = await this.getId()
			this.debug('startWorking', workerId, new Date().toISOString())
			const origin = (await this.state.storage.get('origin')!) as string
			this.zero = new Zero({
				userId: workerId,
				getUri: async () => {
					const u = new URL(origin)
					u.pathname = `/app/${workerId}/connect`
					u.searchParams.set('accessToken', `${this.env.TEST_AUTH_SECRET}:${workerId}`)
					u.searchParams.set('sessionId', workerId)
					u.searchParams.set('protocolVersion', String(Z_PROTOCOL_VERSION))
					this.debug('getUri', u.toString())
					return u.toString()
				},
				onMutationRejected: (code) =>
					this.coordinator.reportEvent({
						type: 'error',
						error: `mutation rejected ${code}`,
						workerId,
						id: uniqueId(),
					}),
				onClientTooOld: () => {
					this.coordinator.reportEvent({
						type: 'error',
						error: 'Client too old',
						workerId,
						id: uniqueId(),
					})
				},
				trackEvent: (..._args) => {},
			})

			await this.time('zero preload', async () => {
				await this.zero!.query.user.where('id', '=', workerId).preload().complete
			})

			const user = this.zero.store.getFullData()?.user

			this.debug('user?', user, workerId, this.zero.store.getCommittedData())
			if (!user) {
				await this.mutate('create user', async (z) => {
					z.user.insert({
						id: workerId,
						name: 'Test User',
						email: `${workerId}@example.com`,
						color: 'salmon',
						avatar: '',
						exportFormat: 'png',
						exportTheme: 'light',
						exportBackground: false,
						exportPadding: false,
						createdAt: 1731610733963,
						updatedAt: 1731610733963,
						flags: '',
						locale: null,
						animationSpeed: null,
						edgeScrollSpeed: null,
						colorScheme: null,
						isSnapMode: null,
						isWrapMode: null,
						isDynamicSizeMode: null,
						isPasteAtCursorMode: null,
						allowAnalyticsCookie: null,
					})
				})
			}

			for (let i = 0; i < this.num_files; i++) {
				if (this.shouldStop) {
					// console.log('should stop')
					break
				}
				// let file = this.zero.store.getCommittedData()?.files[0]
				// const fileId = file?.id ?? uniqueId()
				let file = null
				const fileId = uniqueId()
				if (!file) {
					await this.mutate('create file ' + fileId, async (z) => {
						z.file.insert({
							id: fileId,
							name: 'name',
							ownerId: workerId,
							ownerName: '',
							ownerAvatar: '',
							thumbnail: '',
							shared: true,
							sharedLinkType: 'edit',
							published: true,
							lastPublished: 123,
							publishedSlug: uniqueId(),
							createdAt: 123,
							updatedAt: 123,
							isEmpty: true,
							isDeleted: false,
							createSource: null,
						})
					})
				}

				file = this.zero.store.getCommittedData()?.files[0]
				assert(file, `No file after mutate ${workerId} ${fileId}`)
			}
		} catch (e) {
			this.coordinator.reportEvent({
				type: 'error',
				error: (e as any)?.stack ?? String(e),
				id: uniqueId(),
				workerId: await this.getId(),
			})
			console.error(e)
		}
	}
	delay = 0

	async start(maxDelay: number, num_files: number, id: string, origin: string) {
		this.debug('worker.start()', id, maxDelay, new Date().toISOString())
		this.state.storage.put('num_files', num_files)
		this.num_files = num_files
		this.state.storage.put('id', id)
		this.state.storage.put('origin', origin)
		await this.time('startup', async () => {
			return Promise.resolve()
		})
		this.delay = Math.floor(Math.random() * maxDelay)
	}

	async work() {
		this.debug('work', new Date().toISOString())
		const alarm = await this.state.storage.getAlarm()
		if (alarm) {
			await this.state.storage.deleteAlarm()
		}
		this.state.storage.setAlarm(Date.now() + this.delay)
	}

	override alarm() {
		this.debug('alarm starting', new Date().toISOString())
		this.startWorking()
	}

	async stop() {
		this.shouldStop = true
		await this.state.storage.deleteAlarm()
		await this.state.storage.deleteAll()
		this.zero?.close()
		this.zero = null
	}

	async getId(): Promise<string> {
		return assertExists(await this.state.storage.get('id')) as string
	}
}
