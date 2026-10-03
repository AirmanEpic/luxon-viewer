import { useState } from "react";

export function HelpModal(props: { setHelpModalOpen: (open: boolean) => void }){
	return <div className="deep-panel absolute left-1/2 transform -translate-x-1/2 right-0 top-11 z-50 rounded-lg p-4 shadow-2xl">
		<div className="px-2 py-1 text-[14px] uppercase tracking-[0.18em] text-muted-foreground">Tag search help</div>
		<div className="text-sm text-foreground extra-space colored-strong">
			<h2>The search bar allows you to search for various tags and use special commands to filter and navigate images efficiently.</h2>
			<p>Search for tags by typing. Each tag is a separate "word", separated by spaces. Normally, underscores are used instead of spaces. </p>
			<p>You may also use several sort methods to organize your search results. Normally sort queries start with "sortBy:" followed by the criteria.</p>
			<p>Sort criteria: <strong>date</strong>, <strong>filename_alphabet</strong>, <strong>file_date_new</strong>, <strong>file_date_old</strong>, <strong>file_size</strong>, <strong>view_new</strong>, <strong>view_old</strong></p>
			<p>in general, _old and _new are just reversed orders from each other.</p>
			<p>Adding multiple tags is the equivalent of "And". In other words, an image must have all the specified tags to appear in the search results. However, you may also explicitly prefix your tag with & to make this obvious</p>
			<p>Prefixing a tag with | indicates an "Or" condition. In other words, an image can have any of the specified tags to appear in the search results.</p>
			<p>Combining & and | allows for complex search queries, enabling you to filter images with precise conditions.</p>
			<p>You can use - instead of & or | to indicate a "not" condition. For example, <strong>-tag</strong> will exclude images with the specified tag from the search results.</p>
			<p>The keyword <strong>folder:</strong> will return all images whose filename contains the specified folder name. Use quotes if the folder name contains spaces.</p>
			<p>You may use the | symbol to indicate an "Or" condition for folder names as well.</p>
			<p>The keyword <strong>special:</strong> has several Luxon-specific functions for filtering images based on specific criteria.</p>
			<p>These special functions are: </p>
			<p><strong>special:favorite</strong> - Filters images that are marked as favorite.</p>
			<p><strong>special:notag</strong> - Filters images that do not have any tags.</p>
			<p><strong>special:tagged</strong> - Filters images that are marked as tagged.</p>
			<p><strong>special:any</strong> - returns ALL images. Useful for quickly viewing the entire image collection.</p>
			<p>You may also prefix special functions with | to indicate an "Or" condition. Ex: <strong> solo |special:notag</strong></p>
			<p>The keyword <strong>limit:</strong> can be used to restrict the number of search results returned. For example, <strong>limit:10</strong> will return only the first 10 matching images.</p>
		</div>
		<button
			onClick={() => props.setHelpModalOpen(false)}
			className="mt-2 rounded border border-border px-3 py-1 text-sm text-foreground"
		>
			Close
		</button>
	</div>
}