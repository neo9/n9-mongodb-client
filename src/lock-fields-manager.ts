import { N9Error } from '@neo9/n9-node-utils';
import _ from 'lodash';
import { ObjectId } from 'mongodb';

import { LangUtils } from './lang-utils';
import { LodashReplacerUtils } from './lodash-replacer.utils';
import { BaseMongoObject, LockField, LockFieldConfiguration, StringMap } from './models';

/**
 * Class that handles the basic operations on locked fields, like locking fields, unlocking fields
 * and update an entity with locked fields.
 */
export class LockFieldsManager<U extends BaseMongoObject> {
	private _arrayWithReferences: StringMap<string[]> = {};

	constructor(private conf: LockFieldConfiguration) {
		this.conf.excludedFields = _.union(this.conf.excludedFields, ['objectInfos', '_id']);
		for (const [key, values] of Object.entries(this.conf.arrayWithReferences ?? {})) {
			const valuesAsArray = _.castArray(values);
			if (LodashReplacerUtils.IS_ARRAY_EMPTY(valuesAsArray)) continue;

			this._arrayWithReferences[key] = valuesAsArray;
		}
	}

	/**
	 * Analyse an entity or a partial entity to determine the list of fields that changed
	 * and return them as lock fields.
	 *
	 * @param newEntity new version of the entity
	 * @param date date of the update
	 * @param userId id of the user performing the update
	 * @param existingEntity old version of the entity, optional
	 */
	public getAllLockFieldsFromEntity(
		newEntity: Partial<U>,
		date: Date,
		userId: string,
		existingEntity?: U,
	): LockField[] {
		let keys: string[];
		if (existingEntity) {
			const entityWithOnlyNewValues = this.pickValues(existingEntity, newEntity, '', true);
			// console.log(`-- entityWithOnlyNewValues  --`, JSON.stringify(entityWithOnlyNewValues, null, 2));
			keys = this.generateAllLockFields(entityWithOnlyNewValues, '');
		} else {
			keys = this.generateAllLockFields(newEntity, '');
		}
		if (LodashReplacerUtils.IS_ARRAY_EMPTY(keys)) return;

		const ret: LockField[] = [];
		for (const key of keys) {
			ret.push({
				path: key,
				metaDatas: {
					date,
					userId,
				},
			});
		}
		return ret;
	}

	/**
	 * Remove all locked fields from the given entity.
	 *
	 * @param entity entity to clean
	 * @param lockFields list of lock fields to remove
	 */
	public pruneEntityWithLockFields(entity: Partial<U>, lockFields: LockField[]): Partial<U> {
		if (!LodashReplacerUtils.IS_ARRAY_EMPTY(lockFields)) {
			for (const lockField of lockFields) {
				let path = lockField.path;
				if (path.includes('[')) {
					// path : a.b.c
					path = this.translatePathToLodashPath(path, entity);
				}
				if (path) {
					_.unset(entity, path);
				}
			}
		}
		LangUtils.removeEmptyDeep(entity, true, true, true);
		return entity;
	}

	/**
	 * Deeply merge an entity with a newer version.
	 * Handles arrays defined in arrayWithReferences.
	 *
	 * @param newEntity new version of the entity
	 * @param existingEntity exisitng (old) version of the entity
	 * @param basePath base field path to start the merge. Pass empty string to start.
	 * @param lockFields list of lock fields of the entity
	 */
	public mergeOldEntityWithNewOne(
		newEntity: any,
		existingEntity: any,
		basePath: string,
		lockFields: LockField[],
	): any {
		let ret;
		if (LangUtils.isClassicObject(newEntity) && LangUtils.isClassicObject(existingEntity)) {
			const keys = _.uniq([..._.keys(newEntity), ..._.keys(existingEntity)]);
			for (const key of keys) {
				newEntity[key] = this.mergeOldEntityWithNewOne(
					newEntity[key],
					existingEntity[key],
					LangUtils.getJoinPaths(basePath, key),
					lockFields,
				);
			}
			ret = {
				...existingEntity,
				...newEntity,
			};
		} else if (Array.isArray(newEntity) && Array.isArray(existingEntity)) {
			if (
				!LodashReplacerUtils.IS_ARRAY_EMPTY(lockFields) &&
				lockFields.find((lockField) => lockField.path.startsWith(basePath))
			) {
				// console.log(`--  key --`, basePath, lockFields.find((lockField) => lockField.path.startsWith(basePath)));
				// console.log('--  ', JSON.stringify(existingEntity, null, 1), ` <<-- existingEntity`);
				// console.log('--  ', JSON.stringify(newEntity, null, 1), ` <<-- newEntity`);
				const fieldCodeNames = this._arrayWithReferences[basePath];
				const mergedArray = [];

				// add existing locked elements
				for (const existingEntityElement of existingEntity) {
					let elementPath: string;
					if (!LodashReplacerUtils.IS_NIL(fieldCodeNames)) {
						const elementUnicity = this.getUnicityStringForArrayElement(
							existingEntityElement,
							fieldCodeNames,
						);
						elementPath = `${basePath}[${elementUnicity}]`;
					} else {
						elementPath = `${basePath}["${existingEntityElement}"]`;
					}
					const lockFieldForCurrentElement = lockFields.find((lockField) =>
						lockField.path.startsWith(elementPath),
					);
					if (lockFieldForCurrentElement) {
						// push only if existingEntityElement is locked
						mergedArray.push(existingEntityElement);
					}
					// else field not locked
				}

				for (const newEntityElement of newEntity) {
					// merge newEntityElement with associated existingEntityElement
					if (!LodashReplacerUtils.IS_NIL(fieldCodeNames)) {
						// array of objects
						const elementUnicity = this.getUnicityStringForArrayElement(
							newEntityElement,
							fieldCodeNames,
						);
						const elementPath = `${basePath}[${elementUnicity}]`;
						const mainUniqKey = fieldCodeNames[0];

						const alreadyAddedElementIndex = mergedArray.findIndex((mergedArrayElement) => {
							return (
								!LodashReplacerUtils.IS_NIL(mergedArrayElement[mainUniqKey]) &&
								this.elementsHaveSameReferences(
									mergedArrayElement,
									newEntityElement,
									fieldCodeNames,
								)
							);
						});
						if (alreadyAddedElementIndex !== -1) {
							mergedArray[alreadyAddedElementIndex] = this.mergeOldEntityWithNewOne(
								mergedArray[alreadyAddedElementIndex],
								newEntityElement,
								elementPath,
								lockFields,
							);
						} else {
							mergedArray.push(newEntityElement);
						}
					} else {
						// array of non objects values
						const elementPath = `${basePath}["${newEntityElement}"]`;
						const alreadyAddedElementIndex = mergedArray.findIndex((mergedArrayElement) =>
							_.isEqual(mergedArrayElement, newEntityElement),
						);
						if (alreadyAddedElementIndex !== -1) {
							mergedArray[alreadyAddedElementIndex] = this.mergeOldEntityWithNewOne(
								mergedArray[alreadyAddedElementIndex],
								newEntityElement,
								elementPath,
								lockFields,
							);
						} else {
							mergedArray.push(newEntityElement);
						}
					}
				}

				return mergedArray;
			}
			return newEntity;
		} else if (newEntity === undefined) {
			ret = existingEntity;
		} else {
			ret = newEntity;
		}
		return ret;
	}

	/**
	 * Clean lock fields
	 *
	 * @param lockFields
	 * @param entity
	 */
	public cleanObsoleteLockFields(lockFields: LockField[], entity: Partial<U>): LockField[] {
		if (LodashReplacerUtils.IS_ARRAY_EMPTY(lockFields)) return lockFields;

		const cleanedLockFields: LockField[] = [];
		for (const lockField of lockFields) {
			const path = this.translatePathToLodashPath(lockField.path, entity);
			const valueFound = _.get(entity, path);
			if (!LodashReplacerUtils.IS_NIL(valueFound)) {
				cleanedLockFields?.push(lockField);
			}
		}
		return cleanedLockFields;
	}

	/**
	 * Convert :
	 * a[b=2]value to a[1].value
	 *
	 * @param path
	 * @param entity
	 */
	private translatePathToLodashPath(path: string, entity: Partial<U>): string {
		const objectsArrayPathRegex =
			/(?<basePath>.*?)\[(?<pairs>[^\]=]+=[^\]&]+(?:&[^\]]+=[^\]&]+)*)\](?<pathLeft>.*)/;
		const simpleArrayPathRegex = /(?<basePath>.*)\[(?<value>[^\]]+)](?<pathLeft>.*)/;
		const match = path.match(objectsArrayPathRegex);
		const matchSimpleArray = path.match(simpleArrayPathRegex);
		let newPath;
		if (match) {
			const groups = match.groups;
			const array: any[] = _.get(entity, groups.basePath);
			if (!LodashReplacerUtils.IS_ARRAY_EMPTY(array)) {
				const codeValuePairs = groups.pairs.split('&').map((pair) => pair.split('='));
				const index = array.findIndex(
					(item) =>
						item &&
						_.every(codeValuePairs, ([code, value]) => {
							return item[code] === value;
						}),
				);
				if (index !== -1) {
					newPath = `${groups.basePath}[${index}]`;
				} else {
					return;
				}
			}
			if (array === null) {
				return groups.basePath;
			}
			if (groups.pathLeft) {
				newPath += this.translatePathToLodashPath(groups.pathLeft, _.get(entity, groups.basePath));
			}
		} else if (matchSimpleArray) {
			const groups = matchSimpleArray.groups;
			const array: any[] = _.get(entity, groups.basePath);
			if (!LodashReplacerUtils.IS_ARRAY_EMPTY(array)) {
				const index = array.findIndex((item) => JSON.stringify(item) === groups.value);
				if (index !== -1) {
					newPath = `${groups.basePath}[${index}]`;
				} else {
					return;
				}
			}
			if (array === null) {
				return groups.basePath;
			}
			if (groups.pathLeft) {
				newPath += this.translatePathToLodashPath(groups.pathLeft, _.get(entity, groups.basePath));
			}
		} else {
			return path;
		}
		return newPath;
	}

	private generateAllLockFields(
		newEntity: any,
		basePath: string,
		ignorePaths?: string[],
	): string[] {
		const keys: string[] = [];
		if (LodashReplacerUtils.IS_NIL(newEntity)) return keys;

		for (const key of Object.keys(newEntity)) {
			const joinedPath = LangUtils.getJoinPaths(basePath, key);
			// excluded fields
			const newEntityElement = newEntity[key];
			if (
				ignorePaths?.includes(key) ||
				this.isExcludedField(joinedPath) ||
				LodashReplacerUtils.IS_NIL(newEntityElement)
			) {
				continue;
			}

			if (LangUtils.isClassicObject(newEntityElement)) {
				// generate a.b.c
				keys.push(...this.generateAllLockFields(newEntityElement, joinedPath));
			} else if (Array.isArray(newEntityElement)) {
				// a[b=1]
				if (Object.keys(this._arrayWithReferences).includes(joinedPath)) {
					const arrayKeys = this._arrayWithReferences[joinedPath];
					for (const element of newEntityElement) {
						if (!LodashReplacerUtils.IS_NIL(element)) {
							const elementUnicity = this.getUnicityStringForArrayElement(element, arrayKeys);
							const arrayPath = `${joinedPath}[${elementUnicity}]`;
							const mainArrayKey = arrayKeys[0];
							if (LodashReplacerUtils.IS_NIL(element[mainArrayKey])) {
								throw new N9Error('wrong-array-definition', 400, {
									newEntity,
									basePath,
									ignorePaths,
									arrayPath,
									mainArrayKey,
								});
							}
							if (LangUtils.isClassicObject(element)) {
								if (LodashReplacerUtils.IS_OBJECT_EMPTY(_.omit(element, arrayKeys))) {
									keys.push(arrayPath);
								} else {
									keys.push(...this.generateAllLockFields(element, arrayPath, arrayKeys));
								}
							} else {
								keys.push(arrayPath);
							}
						}
					}
				} else {
					// a["elementValue"]
					for (const element of newEntityElement) {
						const arrayPath = `${joinedPath}[${JSON.stringify(element)}]`;
						keys.push(arrayPath);
					}
				}
			} else {
				// a
				keys.push(joinedPath);
			}
		}
		return keys;
	}

	private pickValues(
		existingEntity: U | string | number,
		newEntity: Partial<U> | string | number,
		basePath: string,
		pickOnlyNewValues: boolean,
	): Partial<U> | string | number {
		if (LodashReplacerUtils.IS_OBJECT_EMPTY(newEntity)) return;
		if (!LodashReplacerUtils.IS_OBJECT(existingEntity)) {
			if (Array.isArray(existingEntity)) {
				throw new N9Error('invalid-type', 400, { existingEntity, newEntity });
			}
			if (pickOnlyNewValues && existingEntity === newEntity) return;
			return newEntity;
		}

		const ret: any = {};
		const existingEntityKeys = _.keys(existingEntity);
		for (const key of existingEntityKeys) {
			const existingEntityElement = existingEntity[key];
			const currentPath = LangUtils.getJoinPaths(basePath, key);

			if (this.isExcludedField(currentPath)) {
				continue;
			}

			if (LangUtils.isClassicObject(existingEntityElement)) {
				ret[key] = this.pickValues(
					existingEntityElement,
					newEntity[key],
					currentPath,
					pickOnlyNewValues,
				);
				if (LodashReplacerUtils.IS_NIL(ret[key])) {
					delete ret[key];
				}
			} else if (Array.isArray(existingEntityElement)) {
				if (newEntity[key] !== null) {
					ret[key] = this.pickValuesInArray(
						existingEntityElement,
						newEntity[key],
						currentPath,
						pickOnlyNewValues,
					);
				}

				if (LodashReplacerUtils.IS_OBJECT_EMPTY(ret[key])) delete ret[key];
			} else {
				let existingEntityElementToCompare: Date | ObjectId | string = existingEntityElement;
				if (existingEntityElementToCompare instanceof ObjectId) {
					existingEntityElementToCompare = existingEntityElementToCompare.toHexString();
				} else if (existingEntityElementToCompare instanceof Date) {
					existingEntityElementToCompare = existingEntityElementToCompare.toISOString();
				}

				let newEntityElementToCompare: Date | ObjectId | string = newEntity[key];
				if (newEntityElementToCompare instanceof ObjectId) {
					newEntityElementToCompare = newEntityElementToCompare.toHexString();
				} else if (newEntityElementToCompare instanceof Date) {
					newEntityElementToCompare = newEntityElementToCompare.toISOString();
				}

				if (
					(!pickOnlyNewValues || existingEntityElementToCompare !== newEntityElementToCompare) &&
					!LodashReplacerUtils.IS_NIL(newEntity[key])
				) {
					ret[key] = newEntity[key];
				}
			}
		}

		for (const newEntityKey of Object.keys(newEntity)) {
			if (!existingEntityKeys.includes(newEntityKey)) {
				ret[newEntityKey] = newEntity[newEntityKey];
			}
		}
		// console.log(`-- pickOnlyNewValues  --`);
		// console.log(JSON.stringify(existingEntity, null, 2));
		// console.log(`-- -- -- -- -- -- -- -- -- --`);
		// console.log(JSON.stringify(newEntity, null, 2));
		// console.log(`-- -- -- -- -- == == == ====>`);
		// console.log(JSON.stringify(ret));
		if (LodashReplacerUtils.IS_OBJECT_EMPTY(ret)) {
			// console.log(`-- return undefined --`);
			return;
		}

		return ret;
	}

	private pickValuesInArray(
		existingEntityArray: any[],
		newEntityElement: any[],
		currentPath: string,
		pickOnlyNewValues: boolean,
	): any[] {
		const codeKeyNames = this._arrayWithReferences[currentPath];

		// If one delete an array element, we lock all existing elements by returning the new array as such
		if (existingEntityArray.length > newEntityElement?.length) {
			return newEntityElement;
		}

		const ret = [];
		for (let i = 0; i < Math.max(existingEntityArray.length, newEntityElement?.length); i += 1) {
			const existingEntityElementArrayElement = existingEntityArray[i];
			const newEntityElementArrayElement = _.get(newEntityElement, [i]);

			let shouldPickOnlyNewValues = pickOnlyNewValues;
			if (
				shouldPickOnlyNewValues &&
				codeKeyNames &&
				!LodashReplacerUtils.IS_NIL(existingEntityElementArrayElement) &&
				!LodashReplacerUtils.IS_NIL(newEntityElementArrayElement)
			) {
				shouldPickOnlyNewValues = this.elementsHaveSameReferences(
					existingEntityElementArrayElement,
					newEntityElementArrayElement,
					codeKeyNames,
				);
			}

			const newValue = this.pickValues(
				existingEntityElementArrayElement,
				newEntityElementArrayElement,
				currentPath,
				shouldPickOnlyNewValues,
			);

			if (!LodashReplacerUtils.IS_NIL(newValue)) {
				codeKeyNames?.forEach((codeKeyName) => {
					newValue[codeKeyName] = _.get(newEntityElementArrayElement, codeKeyName);
				});
				ret.push(newValue);
			}
		}

		return ret;
	}

	private isExcludedField(path: string): boolean {
		return _.some(this.conf.excludedFields, (excludedField) => {
			if (excludedField instanceof RegExp) {
				return path.match(excludedField);
			}
			return excludedField === path;
		});
	}

	private getUnicityStringForArrayElement(
		entityElement: any,
		arrayWithReferences: string[],
	): string {
		const filteredReferences = arrayWithReferences.filter(
			(reference) => !LodashReplacerUtils.IS_NIL(entityElement[reference]),
		);
		const mappedReferences = filteredReferences.map(
			(reference) => `${reference}=${entityElement[reference]}`,
		);
		return mappedReferences.join('&');
	}

	private elementsHaveSameReferences(
		firstElement: any,
		secondElement: any,
		referenceKeys: string[],
	): boolean {
		return _.every(referenceKeys, (key) => firstElement[key] === secondElement[key]);
	}
}
