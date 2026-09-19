/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export const Collections = {
	Authorigins: "_authOrigins",
	Externalauths: "_externalAuths",
	Mfas: "_mfas",
	Otps: "_otps",
	Superusers: "_superusers",
	Carts: "carts",
	ModifierLists: "modifier_lists",
	Orders: "orders",
	ProductVariations: "product_variations",
	Products: "products",
	Users: "users",
	WebhookEvents: "webhook_events",
} as const
export type Collections = typeof Collections[keyof typeof Collections]

// Alias types for improved usability
export type IsoDateString = string
export type IsoAutoDateString = string & { readonly autodate: unique symbol }
export type RecordIdString = string
export type FileNameString = string & { readonly filename: unique symbol }
export type HTMLString = string

type ExpandType<T> = unknown extends T
	? T extends unknown
		? { expand?: unknown }
		: { expand: T }
	: { expand: T }

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString
	collectionId: string
	collectionName: Collections
} & ExpandType<T>

export type AuthSystemFields<T = unknown> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated: IsoAutoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated: IsoAutoDateString
}

export type MfasRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	method: string
	recordRef: string
	updated: IsoAutoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated: IsoAutoDateString
}

export type SuperusersRecord = {
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export type CartsRecord<Titems = unknown> = {
	created: IsoAutoDateString
	id: string
	items?: null | Titems
	token_hash?: string
	updated: IsoAutoDateString
	user?: RecordIdString
}

export type ModifierListsRecord<Tmodifiers = unknown> = {
	created: IsoAutoDateString
	id: string
	max_selected?: number
	min_selected?: number
	modifiers?: null | Tmodifiers
	name?: string
	square_modifier_list_id: string
	square_version?: number
	updated: IsoAutoDateString
}

export const OrdersStatusOptions = {
	"pending_payment": "pending_payment",
	"paid": "paid",
	"preparing": "preparing",
	"ready": "ready",
	"completed": "completed",
	"cancelled": "cancelled",
} as const
export type OrdersStatusOptions = typeof OrdersStatusOptions[keyof typeof OrdersStatusOptions]
export type OrdersRecord<Tline_items = unknown> = {
	access_token_hash?: string
	checkout_url?: string
	completed_at?: IsoDateString
	created: IsoAutoDateString
	currency?: string
	customer_email: string
	customer_name: string
	customer_phone?: string
	estimated_ready_at?: IsoDateString
	id: string
	idempotency_key?: string
	last_synced_at?: IsoDateString
	line_items?: null | Tline_items
	notes?: string
	paid_at?: IsoDateString
	square_order_id?: string
	square_order_version?: number
	square_payment_id?: string
	square_payment_link_id?: string
	status: OrdersStatusOptions
	subtotal_amount?: number
	tax_amount?: number
	total_amount?: number
	updated: IsoAutoDateString
	user?: RecordIdString
}

export type ProductVariationsRecord = {
	created: IsoAutoDateString
	currency: string
	id: string
	name?: string
	ordinal?: number
	price_amount?: number
	product: RecordIdString
	sellable?: boolean
	square_variation_id: string
	square_version?: number
	updated: IsoAutoDateString
}

export const ProductsCategoryOptions = {
	"signature": "signature",
	"pantry": "pantry",
	"merch": "merch",
	"matcha": "matcha",
} as const
export type ProductsCategoryOptions = typeof ProductsCategoryOptions[keyof typeof ProductsCategoryOptions]

export const ProductsCatalogStatusOptions = {
	"unlinked": "unlinked",
	"active": "active",
	"archived": "archived",
	"deleted": "deleted",
} as const
export type ProductsCatalogStatusOptions = typeof ProductsCatalogStatusOptions[keyof typeof ProductsCatalogStatusOptions]
export type ProductsRecord<Tingredients = unknown, Tmodifier_lists = unknown> = {
	badge?: string
	catalog_status: ProductsCatalogStatusOptions
	category?: ProductsCategoryOptions
	created: IsoAutoDateString
	description?: string
	id: string
	ingredients?: null | Tingredients
	modifier_lists?: null | Tmodifier_lists
	name: string
	pour_bottom?: string
	pour_top?: string
	size?: string
	slug: string
	sort_order?: number
	square_item_id?: string
	square_version?: number
	synced_at?: IsoDateString
	tagline?: string
	updated: IsoAutoDateString
}

export type UsersRecord = {
	avatar?: FileNameString
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	name?: string
	password: string
	phone?: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export type WebhookEventsRecord = {
	created: IsoAutoDateString
	event_id: string
	event_type?: string
	id: string
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type CartsResponse<Titems = unknown, Texpand = unknown> = Required<CartsRecord<Titems>> & BaseSystemFields<Texpand>
export type ModifierListsResponse<Tmodifiers = unknown, Texpand = unknown> = Required<ModifierListsRecord<Tmodifiers>> & BaseSystemFields<Texpand>
export type OrdersResponse<Tline_items = unknown, Texpand = unknown> = Required<OrdersRecord<Tline_items>> & BaseSystemFields<Texpand>
export type ProductVariationsResponse<Texpand = unknown> = Required<ProductVariationsRecord> & BaseSystemFields<Texpand>
export type ProductsResponse<Tingredients = unknown, Tmodifier_lists = unknown, Texpand = unknown> = Required<ProductsRecord<Tingredients, Tmodifier_lists>> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>
export type WebhookEventsResponse<Texpand = unknown> = Required<WebhookEventsRecord> & BaseSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	carts: CartsRecord
	modifier_lists: ModifierListsRecord
	orders: OrdersRecord
	product_variations: ProductVariationsRecord
	products: ProductsRecord
	users: UsersRecord
	webhook_events: WebhookEventsRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	carts: CartsResponse
	modifier_lists: ModifierListsResponse
	orders: OrdersResponse
	product_variations: ProductVariationsResponse
	products: ProductsResponse
	users: UsersResponse
	webhook_events: WebhookEventsResponse
}

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<{
	// Omit AutoDate fields
	[K in keyof T as Extract<T[K], IsoAutoDateString> extends never ? K : never]: 
		// Convert FileNameString to File
		T[K] extends infer U ? 
			U extends (FileNameString | FileNameString[]) ? 
				U extends any[] ? File[] : File 
			: U
		: never
}, 'id'>

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString
	email: string
	emailVisibility?: boolean
	password: string
	passwordConfirm: string
	verified?: boolean
} & ProcessCreateAndUpdateFields<T>

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString
} & ProcessCreateAndUpdateFields<T>

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string
	emailVisibility?: boolean
	oldPassword?: string
	password?: string
	passwordConfirm?: string
	verified?: boolean
}

// Update type for Base collections
export type UpdateBase<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>
>

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? CreateAuth<CollectionRecords[T]>
		: CreateBase<CollectionRecords[T]>

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? UpdateAuth<CollectionRecords[T]>
		: UpdateBase<CollectionRecords[T]>

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>
} & PocketBase
