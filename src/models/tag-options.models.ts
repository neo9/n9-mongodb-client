export interface TagOptions {
	/**
	 * If true, the last update will be updated
	 * Defaults to true.
	 */
	updateLastUpdate?: boolean;
}

export interface AddTagOptions extends TagOptions {
	/**
	 * Tag to add.
	 * If not present, it will be auto-generated.
	 */
	tag?: string;
}

export type RemoveTagOptions = TagOptions;
