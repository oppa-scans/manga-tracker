/* globals page, base_url, use_live_countdown_timer, list_sort_type, list_sort_order */
$(function(){
	'use strict';
	if(page !== 'dashboard') { return false; }

	$.tablesorter.addParser({
		id: 'updated-at',

		is: function() {
			return false; // return false so this parser is not auto detected
		},

		format: function(s, table, cell, cellIndex) {
			return parseInt($(cell).attr('data-updated-at').replace(/[^0-9]+/g, ''));
		},

		type: 'numeric'
	});

	$.tablesorter.addParser({
		id: 'latest',

		is: function() {
			return false; // return false so this parser is not auto detected
		},

		format: function(s, table, cell, cellIndex) {
			return parseInt($(cell).closest('tr').find('td:eq(1) .sprite-time').attr('title').replace(/[^0-9]+/g, ''));
		},

		type: 'numeric'
	});

	/**
	 * @return {boolean|null}
	 */
	$.tablesorter.filter.types.FindMalId = function( config, data ) {
		if(/^mal:[0-9]+$/.test(data.iFilter)) {
			let searchID  = data.iFilter.match(/^mal:([0-9]+)$/)[1],
			    currentID = data.$row.find('> td:eq(1) .sprite-myanimelist-net').attr('title');

			return searchID === currentID;
		}
		return null;
	};

	$('.tracker-table').tablesorter({
		initialized: function(table) {
			//fix for being unable to sort title column by asc on a single click if using "Unread (Alphabetical)" sort
			//SEE: https://github.com/Mottie/tablesorter/issues/1445#issuecomment-321537911
			let sortVars = table.config.sortVars;
			sortVars.forEach(function(el) {
				// reset the internal counter
				el.count = -1;
			});
		},

		//FIXME: This is kinda unneeded, and it does add a longer delay to the tablesorter load, but we need it for setting the header sort direction icons..
		sortList: getListSort(list_sort_type, list_sort_order),

		headers : {
			1 : { sortInitialOrder : 'asc'  },
			2 : { sortInitialOrder : 'desc', sorter: 'updated-at' },
			3 : { sortInitialOrder : 'desc', sorter: 'latest' }
		},

		widgets: ['zebra', 'filter'],
		widgetOptions : {
			filter_external : '#search',
			filter_columnFilters: false,
			filter_saveFilters : false,
			filter_reset: '.reset'
		}
	});

	/** UX Improvements **/

	//This makes it easier to press the row checkbox.
	$('.tracker-table').find('> tbody > tr > td:nth-of-type(1)').click(function (e) {
		if(!$(e.target).is('input')) {
			let checkbox = $(this).find('> input[type=checkbox]');
			$(checkbox).prop('checked', !checkbox.prop('checked'));
		}
	});

	//This shows/hides the row info row.
	$('.toggle-info').click(function(e) {
		e.preventDefault();

		$(this).find('+ .more-info').toggle();
		if($(this).text() === 'More info') {
			$(this).text('Hide info');
		} else {
			$(this).text('More info');

			//Hide input when hiding info
			$(this).closest('tr').find('.tag-edit').addClass('hidden');
		}
	});

	//Set favicon to unread ver.
	if(! /^\/list\//.test(location.pathname)) {
		updateFavicon();
	}

	//Click to hide notice
	$('#update-notice').on('closed.bs.alert', function() {
		$.post(base_url + 'ajax/hide_notice');
	});

	//Change list when clicking category tabs
	$('#category-nav').find('> .nav > li > a').click(function(e) {
		e.preventDefault();

		//Change category active state
		$(this).closest('ul').find('> .active').removeClass('active');
		$(this).parent().addClass('active');

		$('.tracker-table:visible').hide();

		let datalist = $(this).attr('data-list'),
		    newTable = $(`.tracker-table[data-list="${datalist}"]`);

		newTable.show();

		//Trigger update to generate even/odd rows. Tablesorter doesn't appear to auto-generate on hidden tables for some reason..
		if(!newTable.has('.odd, .even').length) {
			newTable.trigger('update', [true]);
		}

		//Scroll to top of page
		$('html, body').animate({ scrollTop: 0 }, 'slow');
	});

	setupStickyListHeader();

	setupNavOptions();

	//Setup update timer
	if(typeof use_live_countdown_timer !== 'undefined' && use_live_countdown_timer && (! /^\/list\//.test(location.pathname))) {
		let timer_obj = $('#update-timer'),
		    timer_arr = timer_obj.text().split(':'),
		    time_left = parseInt(timer_arr[0] * 60 * 60, 10) + parseInt(timer_arr[1] * 60, 10) + parseInt(timer_arr[2], 10);
		let timer = setInterval(() => {
			let hours   = parseInt(time_left / 60 / 60, 10).toString(),
			    minutes = parseInt(time_left / 60 % 60, 10).toString(),
			    seconds = parseInt(time_left % 60, 10).toString();

			if(hours.length === 1)   { hours   = '0' + hours;   }
			if(minutes.length === 1) { minutes = '0' + minutes; }
			if(seconds.length === 1) { seconds = '0' + seconds; }

			timer_obj.text(hours + ':' + minutes + ':' + seconds);

			if (--time_left < 0) {
				clearInterval(timer);

				//Wait one minute, then change favicon to alert user of update
				setTimeout(function(){
					//TODO: This "should" just be favicon.updated.ico, and we should handle any ENV stuff on the backend
					$('link[rel*="icon"]').attr('href', `${base_url}favicon.production.updated.ico`);

					//location.reload(); //TODO: We should have an option for this?
				}, 60000);
			}
		}, 1000);
	}

	/** Setup title handlers **/

	//Update latest chapter (via "I've read the latest chapter")
	$('.update-read').click(function(e, data) {
		let row             = $(this).closest('tr'),
		    table           = $(this).closest('table'),
		    chapter_id      = $(row).attr('data-id'),
		    current_chapter = $(row).find('.current'),
		    latest_chapter  = $(row).find('.latest');

		if (!(data && data.isUserscript)) {
			let postData = {
				id     : chapter_id,
				chapter: latest_chapter.attr('data-chapter')
			};
			$.post(base_url + 'ajax/update_inline', postData, () => {
				$(current_chapter)
					.attr('href', $(latest_chapter).attr('href'))
					.text($(latest_chapter).text());

				updateUnread(table, row);
			}).fail((jqXHR, textStatus, errorThrown) => {
				_handleAjaxError(jqXHR, textStatus, errorThrown);
			});
		} else {
			console.log('Userscript is updating table...');

			//Userscript handles updating current_chapter url/text.

			if(data.isLatest) {
				updateUnread(table, row);
			} else {
				let chapter_e = current_chapter.parent();

				//Update updated-at time for sorting purposes.
				chapter_e.attr('data-updated-at', (new Date()).toISOString().replace(/^([0-9]+-[0-9]+-[0-9]+)T([0-9]+:[0-9]+:[0-9]+)\.[0-9]+Z$/, '$1 $2'));
				table.trigger('updateCell', [chapter_e[0], false, null]);
			}
		}
	});

	//Ignore latest chapter
	$('.ignore-latest').click(function() {
		let row             = $(this).closest('tr'),
		    table           = $(this).closest('table'),
		    chapter_id      = $(row).attr('data-id'),
		    current_chapter = $(row).find('.current'),
		    latest_chapter  = $(row).find('.latest');

		if(confirm('Ignore latest chapter?')) {
			let postData = {
				id      : chapter_id,
				chapter : latest_chapter.attr('data-chapter')
			};
			$.post(base_url + 'ajax/ignore_inline', postData, () => {
				$(current_chapter).parent().append(
					$('<span/>', {class: 'hidden-chapter', title: 'This latest chapter was marked as ignored.', text: $(latest_chapter).text()})
				);

				updateUnread(table, row);
			}).fail((jqXHR, textStatus, errorThrown) => {
				_handleAjaxError(jqXHR, textStatus, errorThrown);
			});
		}
	});

	$('#mass-action').find('> select').change(function() {
		let redirect = false;

		let checked_rows = $('.tracker-table:visible').find('tr:has(td input[type=checkbox]:checked)'),
		    total_rows   = checked_rows.length;
		if(total_rows > 0) {
			let row_ids = $(checked_rows).map(function() {
				return parseInt($(this).attr('data-id'));
			}).toArray();

			let postData = {
				'id[]' : row_ids
			};
			switch($(this).val()) {
				case 'delete':
					if(confirm(`Are you sure you want to delete the ${total_rows} selected row(s)?`)) {
						$.post(base_url + 'ajax/delete_inline', postData, () => {
							redirect = true;
							location.reload();
						}).fail((jqXHR, textStatus, errorThrown) => {
							_handleAjaxError(jqXHR, textStatus, errorThrown);
						});
					}

					break;

				case 'tag':
					if(confirm(`Are you sure you want to edit the tags of ${total_rows} selected row(s)?`)) {
						let tags = prompt('Tags: ');
						validate_tag_list(tags, (tag_list_new) => {
							postData.tag_string = tag_list_new;

							$.post(base_url + 'ajax/mass_tag_update', postData, () => {
								redirect = true;
								location.reload(); //unlike a normal tag update, it's probably better to just force a reload here.
							}).fail((jqXHR, textStatus, errorThrown) => {
								_handleAjaxError(jqXHR, textStatus, errorThrown);
							});
						});
					}
					break;

				default:
					//do nothing
					break;
			}
		} else {
			alert('No selected series found.');
		}

		if($(this).val() !== 'n/a' && !redirect) { console.log('resetting value'); $(this).val('n/a'); } //Reset change if user hasn't followed through with mass action
	});

	//Set MAL ID
	$('.set-mal-id').click(function(e) {
		e.preventDefault();

		let _this          = this,
		    current_mal_id = $(this).attr('data-mal-id');

		//If trackr.moe already has it's own MAL id for the series, ask if the user wants to override it (if they haven't already).
		if($(this).attr('data-mal-type') === 'title' && $(this).attr('data-mal-id') && !confirm('A MAL ID already exists for this series on our backend.\n Are you sure you want to override it?')) { return; }

		let new_mal_id     = prompt('MAL ID:', current_mal_id);
		if(/^([0-9]+|none)?$/.test(new_mal_id)) {
			if(/^[0-9]+$/.test(new_mal_id)) { new_mal_id = parseInt(new_mal_id); } //Stops people submitting multiple 0s

			let tr         = $(this).closest('tr'),
			    td         = tr.find('td:eq(1)'),
			    id         = tr.attr('data-id'),
			    icon_link  = $(td).find('.sprite-myanimelist-net').parent(),
			    iconN_link = $(td).find('.sprite-myanimelist-net-none').parent(),
			    id_text    = $(this).find('+ span');

			if(new_mal_id !== '' && new_mal_id !== 'none' && new_mal_id !== 0) {
				set_mal_id(id, new_mal_id, () => {
					$(iconN_link).remove(); //Make sure to remove MAL none icon when changing ID
					if(icon_link.length) {
						//icon exists, just change link
						$(icon_link).attr('href', 'https://myanimelist.net/manga/'+new_mal_id);
					} else {
						$($('<a/>', {href: 'https://myanimelist.net/manga/'+new_mal_id, class: 'mal-link'}).append(
							$('<i/>', {class: 'sprite-site sprite-myanimelist-net', title: new_mal_id})
						)).prepend(' ').insertAfter(td.find('.sprite-site'));
					}

					set_id_text($(_this), id_text, new_mal_id);
				});
			} else {
				if(new_mal_id === 'none' || new_mal_id === 0) {
					set_mal_id(id, '0', () => {
						icon_link.remove();
						iconN_link.remove();

						$($('<a/>', {class: 'mal-link'}).append(
							$('<i/>', {class: 'sprite-site sprite-myanimelist-net-none', title: new_mal_id})
						)).prepend(' ').insertAfter(td.find('.sprite-site'));

						set_id_text($(_this), id_text, 'none');
					});
				} else {
					set_mal_id(id, null, () => {
						icon_link.remove();
						iconN_link.remove();
						id_text.remove();
					});
				}
			}

			$(this).attr('data-mal-id', new_mal_id);
		} else if (new_mal_id === null) {
			//input cancelled, do nothing
		} else {
			alert('MAL ID can only contain numbers.');
		}

		function set_id_text(_this, id_text, text) {
			text = (text !== '0' ? text : 'none');
			if(id_text.length) {
				id_text.find('small').text(text);
			} else {
				$('<span/>').append(
					$('<small/>', {text: text})
				).prepend(' (').append(')').insertAfter(_this);
			}
		}

		function set_mal_id(id, mal_id, successCallback) {
			successCallback = successCallback || function(){};

			let postData = {
				'id'     : id,
				'mal_id' : mal_id
			};
			$.post(base_url + 'ajax/set_mal_id', postData, () => {
				successCallback();
			}).fail((jqXHR, textStatus, errorThrown) => {
				_handleAjaxError(jqXHR, textStatus, errorThrown);
			});
		}
	});

	//Set tags
	setupTagEditor();

	//Set category
	$('#move-input').change(function() {
		let selected = $(this).find(':selected');
		if(selected.is('[value]')) {
			let checked_rows = $('.tracker-table:visible').find('tr:has(td input[type=checkbox]:checked)');
			if(checked_rows.length > 0) {
				let row_ids = $(checked_rows).map(function() {
					return parseInt($(this).attr('data-id'));
				}).toArray();

				$.post(base_url + 'ajax/set_category', {'id[]' : row_ids, category : selected.attr('value')}, () => {
					location.reload();
				}).fail((jqXHR, textStatus, errorThrown) => {
					_handleAjaxError(jqXHR, textStatus, errorThrown);
				});
			}
		}
	});

	/** FUNCTIONS **/

	function setupStickyListHeader() {
		let $window    = $(window),
		    nav        = $('#list-nav'),
		    offset     = nav.offset().top - nav.find('> ul').height() - 21,
		    list_table = $('table[data-list]');
		$window.scroll(function() {
			//FIXME: Using .scroll for this seems really slow. Is there no pure CSS way of doing this?
			//FIXME: The width of the nav doesn't auto-adjust to change window width (since we're calcing it in JS)..
			handleScroll();
		});
		handleScroll(); //Make sure we also trigger on page load.

		function handleScroll() {
			if($window.scrollTop() >= offset) {
				list_table.css('margin-top', '97px');
				nav.addClass('fixed-header');
				nav.css('width', $('#list-nav').parent().width() + 'px');
			} else {
				list_table.css('margin-top', '5px');
				nav.removeClass('fixed-header');
				nav.css('width', 'initial');
			}
		}
	}

	function setupNavOptions() {
		//Setup nav slide toggle
		$('#toggle-nav-options').click(function(e) {
			e.preventDefault();

			let icon    = $(this).find('> i'),
			    options = $('#nav-options');
			icon.toggleClass('down');

			if(icon.hasClass('down')) {
				options.hide().slideDown(500);
			} else {
				options.show().slideUp(500);
			}
		});

		$('.list_sort').change(function() {
			let tables    = $('.tracker-table'),
			    type      = $('select[name=list_sort_type]').val(),
			    order_ele = $('select[name=list_sort_order]'),
			    order     = order_ele.val();

			if(type === 'n/a') { return; } //do nothing, if n/a

			if($(this).attr('name') === 'list_sort_type') {
				//Type has changed, so set order to default.
				switch(type) {
					case 'unread_latest':
						order = 'desc';
						break;

					case 'my_status':
						order = 'desc';
						break;

					case 'latest':
						order = 'desc';
						break;

					default:
						order = 'asc';
						break;
				}
				order_ele.val(order); //thankfully .val doesn't re-trigger .change
			}

			tables.trigger('sorton', [ getListSort(type, order) ]);
		});

		$('.tracker-table').bind('sortEnd', function(/**e, table**/) {
			let type_ele  = $('select[name=list_sort_type]'),
				order_ele = $('select[name=list_sort_order]'),
				sortList = this.config.sortList,
				sort = sortList.reduce(function(acc, cur, i) {
					acc[cur[0]] = cur[1];
					return acc;
				}, {});

			let sortType  = 'n/a',
			    sortOrder = 'asc';
			switch(Object.keys(sort).join()) {
				case '0,1':
					if(sort[0] === 0) {
						sortType  = 'unread';
						sortOrder = (sort[1] === 0 ? 'asc' : 'desc');
					}
					break;

				case '0,3':
					if(sort[0] === 0) {
						sortType  = 'unread-latest';
						sortOrder = (sort[1] === 0 ? 'asc' : 'desc');
					}
					break;

				case '1':
					sortType = 'alphabetical';
					sortOrder = (sort[1] === 0 ? 'asc' : 'desc');
					break;

				case '2':
					sortType = 'my_status';
					sortOrder = (sort[2] === 0 ? 'asc' : 'desc');
					break;

				case '3':
					sortType = 'latest';
					sortOrder = (sort[3] === 0 ? 'asc' : 'desc');
					break;

				default:
					//we already default to n/a
					break;
			}

			type_ele.val(sortType);
			order_ele.val(sortOrder);
		});
	}
	function getListSort(type, order) {
		let sortArr = [];

		let sortOrder = (order === 'asc' ? 'a' : 'd');
		switch(type) {
			case 'unread':
				sortArr = [[/* unread */ 0, 'a'], [/* title*/ 1, sortOrder]];
				break;

			case 'unread_latest':
				sortArr = [[/* unread */ 0, 'a'], [/* title*/ 3, sortOrder]];
				break;

			case 'alphabetical':
				sortArr = [[/* title */ 1, sortOrder]];
				break;

			case 'my_status':
				sortArr = [[/* unread */ 2, sortOrder]];
				break;

			case 'latest':
				sortArr = [[/* unread */ 3, sortOrder]];
				break;

			default:
				break;
		}

		return sortArr;
	}

	function setupTagEditor() {
		//Toggle input on clicking "Edit"
		$('.edit-tags').click(function(e) {
			e.preventDefault();
			let editorEle = $(this).parent().find('.tag-edit');
			editorEle.toggleClass('hidden');
			if(!editorEle.hasClass('hidden')) {
				//NOTE: setTimeout is required here due to a chrome bug.
				setTimeout(function(){
					let input = editorEle.find('> input');
					input.focus();

					//Resetting value to force pointer to end of line
					//SEE: https://stackoverflow.com/a/8631903
					let tmp_val = input.val();
					input.val('');
					input.val(tmp_val);
				}, 1);
			}
		});


		//Simulate "Save" click on enter press.
		$('.tag-edit input').on('keypress', function(e) {
			if(e.which === /* enter */ 13) {
				$(this).closest('.tag-edit').find('[type=button]').click();
			}
		});

		//Submit tags
		$('.tag-edit [type=button]').click(function() {
			let _this = this;
			//CHECK: We would use jQuery.validate here but I don't think it works without an actual form.
			let input    = $(this).closest('.tag-edit').find('input'),
			    tag_list = input.val().toString().trim().replace(/,,/g, ','),
			    id       = $(this).closest('tr').attr('data-id');

			//Validation
			validate_tag_list(tag_list, (tag_list_new) => {
				let postData = {
					'id'         : id,
					'tag_string' : tag_list_new
				};
				$.post(base_url + 'ajax/tag_update', postData, () => {
					$(input).val(tag_list_new);
					$(_this).closest('.more-info').find('.tag-list').text(tag_list_new || 'none');
					$(_this).closest('.tag-edit').toggleClass('hidden');
				}).fail((jqXHR, textStatus, errorThrown) => {
					_handleAjaxError(jqXHR, textStatus, errorThrown);
				});
			});
		});
	}
	function validate_tag_list(tag_list, callback) {
		if(!$.isArray(tag_list)) { tag_list = tag_list.trim().replace(/,,/g, ','); }

		if(/^[a-z0-9\-_,:]{0,255}$/.test(tag_list)) {
			let tag_array    = uniq(tag_list.split(',')).filter(function(n){ return n !== ''; }),
			    tag_list_new = tag_array.join(',');
			if($.inArray('none', tag_array) === -1) {
				if((tag_list.match(/\bmal:(?:[0-9]+|none)\b/g) || []).length <= 1) {
					callback(tag_list_new);
				} else {
					alert('You can only use one MAL ID tag per series');
				}
			} else {
				alert('"none" is a restricted tag.');
			}
		} else {
			//Tag list is invalid.
			alert('Tags can only contain: lowercase a-z, 0-9, -, :, & _. They can also only have one MAL metatag.');
		}
	}

	function updateUnread(table, row) {
		let totalUnread  = table.find('tr .update-read:not([style])').length,
		    unread_e     = row.find('> td:eq(0) > span'),
		    chapter_e    = row.find('> td:eq(2)'),
		    update_icons = row.find('.update-read, .ignore-latest');

		//Hide update icons
		update_icons.hide();

		//Update updated-at time for sorting purposes.
		chapter_e.attr('data-updated-at', (new Date()).toISOString().replace(/^([0-9]+-[0-9]+-[0-9]+)T([0-9]+:[0-9]+:[0-9]+)\.[0-9]+Z$/, '$1 $2'));
		table.trigger('updateCell', [chapter_e[0], false, null]);

		//Update unread status for sorting purposes.
		unread_e.text('1');
		table.trigger('updateCell', [unread_e[0], false, null]);

		//Update header text
		let unreadText = (totalUnread > 0 ? ` (${totalUnread} unread)` : '');
		table.find('thead > tr > th:eq(1) > div').text('Series'+unreadText);

		//Update data attr
		table.attr('data-unread', totalUnread);

		//Update favicon
		if(table.attr('data-list') === 'reading') {
			updateFavicon();
		}
	}

	function updateFavicon() {
		let unreadCount = $('table[data-list=reading]').attr('data-unread')
		unreadCount = parseInt(unreadCount) > 99 ? '99+' : unreadCount;

		let favicon = $('link[rel="shortcut icon"]');
		if(parseInt(unreadCount) !== 0) {
			let canvas  = $('<canvas/>', {id: 'faviconCanvas', style: '/*display: none*/'})[0];
			//Bug?: Unable to set this via jQuery for some reason..
			canvas.width  = 32;
			canvas.height = 32;

			let context = canvas.getContext('2d');

			let imageObj = new Image();
			imageObj.onload = function(){
				context.drawImage(imageObj, 0, 0, 32, 32);

				context.font      = 'Bold 17px Helvetica';
				context.textAlign = 'right';

				context.lineWidth   = 3;
				context.strokeStyle = 'white';
				context.strokeText(unreadCount, 32, 30);

				context.fillStyle = 'black';
				context.fillText(unreadCount, 32, 30);

				favicon.attr('href', canvas.toDataURL());
			};
			imageObj.src = `${base_url}favicon.ico`;
		} else {
			favicon.attr('href', `${base_url}favicon.ico`);
		}
	}

	/* http://stackoverflow.com/a/9229821/1168377 */
	function uniq(a) { return Array.from(new Set(a)); }

	function _handleAjaxError(jqXHR, textStatus, errorThrown) {
		switch(jqXHR.status) {
			case 400:
				alert('ERROR: ' + errorThrown);
				break;
			case 401:
				alert('Session has expired, please re-log to continue.');
				break;
			case 429:
				alert('ERROR: Rate limit reached.');
				break;
			default:
				alert('ERROR: Something went wrong!\n'+errorThrown);
				break;
		}
	}
});
