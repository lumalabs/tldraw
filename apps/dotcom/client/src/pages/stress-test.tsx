/* eslint-disable no-console */
import { STCoordinatorState } from '@tldraw/dotcom-shared'
import { useEffect, useState } from 'react'
import { fetch, getFromLocalStorage, setInLocalStorage, uniqueId } from 'tldraw'

function useLocalValue(key: string, initialValue: string) {
	const [value, setValue] = useState(getFromLocalStorage(key) ?? initialValue)

	useEffect(() => {
		if (!value) {
			const newValue = window.prompt(`Enter ${key.replace('_', ' ')}`) ?? ''
			setValue(newValue)
		} else {
			setInLocalStorage(key, value)
		}
	}, [value, key])

	return [value, setValue] as const
}

let start = Date.now()

export function Component() {
	const [state, setState] = useState(null as null | STCoordinatorState)
	const [coordinatorUrl] = useLocalValue('st_coordinator_url', '')
	const [accessToken] = useLocalValue('st_access_token', '')
	const [uri] = useLocalValue('st_uri', '')
	const [currentTest, setCurrentTest] = useState<string | null>(null)
	const [workers, setWorkers] = useState(50)
	const [files, setFiles] = useState(5)
	const [startWithin, setStartWithin] = useState(10_000)

	useEffect(() => {
		if (!coordinatorUrl || !accessToken) return
		const interval = setInterval(() => {
			fetch(coordinatorUrl + '/state', {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			})
				.then((res) => res.json())
				.then(setState)
		}, 1000)
		return () => clearInterval(interval)
	}, [coordinatorUrl, accessToken, state?.tests, currentTest])

	if (!state) {
		return <div>Loading...</div>
	}

	const handleStart = async () => {
		start = Date.now()
		const testId = uniqueId()
		setCurrentTest(testId)
		const res = await fetch(coordinatorUrl + `/${testId}/start`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({ uri, workers, files, startWithin }),
		})
		if (res.ok) {
			console.info('test started')
		}
	}
	const handleStop = async () => {
		const res = await fetch(coordinatorUrl + `/${currentTest}/stop`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({ workers }),
		})
		setCurrentTest(null)
		if (res.ok) {
			console.info('test stopped')
		}
	}
	const handleReset = async () => {
		await fetch(coordinatorUrl + '/reset', {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		})
	}

	let results: any[] = []

	if (currentTest) {
		const events = state.tests[currentTest]?.events
		if (events) {
			results = events.filter((event) => !!event.error)
		}
	}

	return (
		<div style={{ height: '100%', overflow: 'scroll' }}>
			<div style={{ display: 'flex', padding: '10px', alignItems: 'center', gap: '5px' }}>
				<span>Workers</span>
				<input value={workers} onChange={(e) => setWorkers(Number(e.target.value))} />
				<span>Files</span>
				<input value={files} onChange={(e) => setFiles(Number(e.target.value))} />
				<span>Start within</span>
				<input value={startWithin} onChange={(e) => setStartWithin(Number(e.target.value))} />
				<button onClick={handleStart}>Start test</button>
				<button onClick={handleStop}>Stop test</button>
				<button onClick={handleReset}>Reset</button>
			</div>
			<pre>{JSON.stringify(results.length > 0 ? results : state, null, 2)}</pre>
		</div>
	)
}
