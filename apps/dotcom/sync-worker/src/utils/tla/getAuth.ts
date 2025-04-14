import { ClerkClient, createClerkClient } from '@clerk/backend'
import { IRequest, StatusError } from 'itty-router'
import { Environment } from '../../types'

export async function requireAuth(
	request: IRequest,
	env: Environment
): Promise<{ userId: string }> {
	const auth = await getAuth(request, env)
	if (!auth) {
		throw new StatusError(401, 'Unauthorized')
	}

	return auth
}

export function getClerkClient(env: Environment) {
	return createClerkClient({
		secretKey: env.CLERK_SECRET_KEY,
		publishableKey: env.CLERK_PUBLISHABLE_KEY,
	})
}

export async function getAuth(
	request: IRequest,
	env: Environment
): Promise<{ userId: string } | null> {
	const token = request.query['accessToken']
	if (
		env.TEST_AUTH_SECRET &&
		typeof token === 'string' &&
		token.startsWith(`${env.TEST_AUTH_SECRET}:`)
	) {
		const userId = token.slice(`${env.TEST_AUTH_SECRET}:`.length)
		return { userId }
	}

	const clerk = getClerkClient(env)

	const state = await clerk.authenticateRequest(request)
	if (state.isSignedIn) return state.toAuth()

	// we can't send headers with websockets, so for those connections we need to pass the token in
	// the query string. `authenticateRequest` only works with headers/cookies though, so we need to
	// copy the query string into the headers.
	const cloned = new Request(request.url, { headers: request.headers })
	const url = new URL(cloned.url)
	if (!cloned.headers.has('Authorization')) {
		if (url.searchParams.has('accessToken')) {
			cloned.headers.set('Authorization', `Bearer ${url.searchParams.get('accessToken')}`)
		} else {
			return null
		}
	}

	const res = await clerk.authenticateRequest(cloned)
	if (!res.isSignedIn) {
		return null
	}

	return res.toAuth()
}

export type SignedInAuth = ReturnType<
	Extract<Awaited<ReturnType<ClerkClient['authenticateRequest']>>, { isSignedIn: true }>['toAuth']
>
