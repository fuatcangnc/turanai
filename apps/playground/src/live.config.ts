/**
 * EmDash Live Content Collections
 *
 * Defines the _emdash collection that handles all content types from the
 * database. Query specific types using getEmDashCollection()/getEmDashEntry().
 * Without this file Astro treats `_emdash` as a regular (static) collection
 * and the queries resolve to empty.
 */

import { defineLiveCollection } from "astro:content";
import { emdashLoader } from "emdash/runtime";

export const collections = {
	_emdash: defineLiveCollection({ loader: emdashLoader() }),
};
