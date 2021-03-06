import { post, get, put, del } from "@utils/apiUtils";
import apiConfig from "@config/api.config";
import commentModel from "@models/comment";
import transcriptionModel from "@models/transcriptionModel";
import { track } from "@api/api";
import event from "@config/trackEvents";

export let actions = () => ({
	showCommentHelperBox: (state, payload) => {
		const ret = {};
		Object.keys(payload)
			.filter(key => payload[key] !== undefined)
			.forEach(key => (ret[key] = payload[key]));

		return {
			...state,
			commentHelperBox: {
				show: true,
				data: {
					...state.commentBox.data,
					...ret
				}
			}
		};
	},
	hideCommentHelperBox: state => {
		return {
			...state,
			commentHelperBox: {
				show: false,
				data: {}
			}
		};
	},
	showCommentBox: (state, payload) => {
		const ret = {};
		Object.keys(payload)
			.filter(key => payload[key] !== undefined)
			.forEach(key => (ret[key] = payload[key]));

		return {
			...state,
			commentBox: {
				show: true,
				data: {
					...state.commentBox.data,
					...ret
				}
			}
		};
	},
	hideCommentBox: state => {
		return {
			...state,
			commentBox: {
				show: false,
				data: {}
			}
		};
	},
	updateMediaAttributes: (state, mediaPayload) => {
		const ret = {};
		Object.keys(mediaPayload)
			.filter(key => mediaPayload[key] !== undefined)
			.forEach(key => (ret[key] = mediaPayload[key]));
		return {
			...state,
			media: {
				...state.media,
				...ret
			}
		};
	},
	toggleVideoControls: (state, { showControls }) => {
		return {
			...state,
			media: {
				...state.media,
				showControls
			}
		};
	},
	hideCommentBoxError: state => {
		return {
			...state,
			commentBox: {
				...state.commentBox,
				error: false
			}
		};
	},
	hideCommentCardError: (state, commentObj) => {
		let commentArray = state.commentPane.allComments,
			newCommentArray = [];
		commentArray.forEach(comment => {
			if (comment.id === commentObj.id) {
				comment = commentObj;
				comment.error = false;
			}
			newCommentArray.push(comment);
		});

		return {
			...state,
			commentPane: {
				...state.commentPane,
				allComments: newCommentArray,
				activeComments: newCommentArray
			}
		};
	},
	postComment: (state, { time, text }) => {
		let payload = commentModel.write({
			...state.app,
			text,
			time
		});
		return post(apiConfig.postComment(state.app), { body: payload }).then(
			response => {
				if (!response.id) {
					return {};
				}
				track(event.POST_COMMENT, {
					commentId: response.id
				});
				let commentArray = state.commentPane.allComments || [];
				let commentObj = commentModel.read({
					...state.app,
					id: response.id,
					createdTime: response.createdTime,
					text,
					time
				});

				let sortedCommentArray = commentModel.sort([
					commentObj,
					...commentArray
				]);
				return {
					...state,
					commentPane: {
						...state.commentPane,
						allComments: sortedCommentArray,
						activeComments: sortedCommentArray
					},
					commentBox: {
						show: false,
						data: {}
					}
				};
			},
			() => {
				return {
					...state,
					commentBox: {
						...state.commentBox,
						error: true
					}
				};
			}
		);
	},
	getAllComments: (state, payload, setState) => {
		let defaultObj = {
			allComments: [],
			activeComments: [],
			isFetching: true
		};
		setState({
			commentPane: defaultObj
		});
		let { filter } = payload;

		if (!state.app.socialId) {
			return {
				...state,
				commentPane: {
					...defaultObj,
					isFetching: false
				}
			};
		}

		return get(apiConfig.getComments(state.app, filter)).then(
			response => {
				let commentArray = [];
				response.socialList.forEach(s => {
					commentArray.push(commentModel.read(s.social));
				});

				let sortedCommentArray = commentModel.sort(commentArray);

				return {
					commentPane: {
						allComments: sortedCommentArray,
						activeComments: sortedCommentArray,
						isFetching: false
					}
				};
			},
			() => {
				return {
					commentPane: {
						...defaultObj,
						isFetching: false
					}
				};
			}
		);
	},
	deleteComment: (state, { commentObj, isCommentBox }) => {
		let urlObj = {
			cname: state.app.cname,
			socialId: commentObj.id
		};

		return del(apiConfig.deleteComment(urlObj)).then(
			() => {
				track(event.DELETE_COMMENT, {
					commentId: commentObj.id,
					source: isCommentBox ? "seekbar" : "tab"
				});
				let commentArray = state.commentPane.allComments,
					newCommentArray = [];
				commentArray.forEach(comment => {
					if (comment.id !== commentObj.id) {
						newCommentArray.push(comment);
					}
				});

				let sortedCommentArray = commentModel.sort(newCommentArray);

				let finalState = {
					...state,
					commentPane: {
						...state.commentPane,
						allComments: sortedCommentArray,
						activeComments: sortedCommentArray
					}
				};

				if (
					state.commentBox.show &&
					commentObj.id === state.commentBox.data.id
				) {
					finalState = {
						...finalState,
						commentBox: {
							show: false,
							data: {}
						}
					};
				}

				return finalState;
			},
			() => {}
		);
	},
	editComment: (state, { commentObj, isCommentBox }) => {
		let urlObj = {
			cname: state.app.cname,
			socialId: commentObj.id
		};

		let payload = commentModel.write({
			...state.app,
			text: commentObj.text,
			time: commentObj.time
		});

		return put(apiConfig.editComment(urlObj), { body: payload }).then(
			() => {
				track(event.EDIT_COMMENT, {
					commentId: commentObj.id,
					source: isCommentBox ? "seekbar" : "tab"
				});
				let commentArray = state.commentPane.allComments,
					newCommentArray = [];
				commentArray.forEach(comment => {
					if (comment.id === commentObj.id) {
						comment = { ...comment, ...commentObj };
					}
					newCommentArray.push(comment);
				});

				let finalObj = {
					...state,
					commentPane: {
						...state.commentPane,
						allComments: newCommentArray,
						activeComments: newCommentArray
					}
				};

				if (isCommentBox) {
					finalObj = {
						...finalObj,
						commentBox: {
							show: false,
							data: {}
						}
					};
				}

				return finalObj;
			},
			() => {
				if (isCommentBox) {
					return {
						...state,
						commentBox: {
							...state.commentBox,
							error: true
						}
					};
				}
				let commentArray = state.commentPane.allComments,
					newCommentArray = [];
				commentArray.forEach(comment => {
					if (comment.id === commentObj.id) {
						comment = commentObj;
						comment.error = true;
					}
					newCommentArray.push(comment);
				});

				return {
					...state,
					commentPane: {
						...state.commentPane,
						allComments: newCommentArray,
						activeComments: newCommentArray
					}
				};
			}
		);
	},
	filterComments: (state, { authorId }) => {
		let commentArray = state.commentPane.allComments,
			newCommentArray = [];

		commentArray.forEach(comment => {
			if (comment.author.id === authorId) {
				newCommentArray.push(comment);
			}
		});
		newCommentArray = newCommentArray.length
			? newCommentArray
			: commentArray;
		return {
			...state,
			commentPane: {
				...state.commentPane,
				activeComments: newCommentArray
			}
		};
	},

	// Transcription actions
	getTranscriptionData: (state, payload, setState) => {
		setState({
			transcriptionPane: {
				...state.transcriptionPane,
				timestampedTranscripts: [],
				searchedTranscripts: [],
				transcriptionStatus: "NOT_ENABLED",
				loading: true,
				error: false
			}
		});

		// return {
		// 	...state,
		// 	transcriptionPane: {
		// 		...state.transcriptionPane,
		// 		filter: {
		// 			...state.transcriptionPane.filter,
		// 			evaluationParameters: [
		// 				{
		// 					'name' : 'Knowledge',
		// 					'evalParamId' : 1,
		// 					'keywords' : ['kw knowledge 1', 'kw knowledge 2']
		// 				},
		// 				{
		// 					'name' : 'Clarity',
		// 					'evalParamId' : 2,
		// 					'keywords' : ['kw clarity 1', 'kw clarity 2']
		// 				}
		// 			]
		// 		},
		// 		timestampedTranscripts: commentArray,
		// 		searchedTranscripts: commentArray,
		// 		transcriptStatus: "success"
		// 	}
		// };

		// let requestObj = {
		// 	"transcriptS3Path": state.app.mediaData.transcriptPath
		// };
		let requestObj = {
			userId: state.app.learnerId,
			entityId: state.app.entityId,
			loId: state.app.playableObjectId,
			submissionId: state.app.subjectId
		};
		return post(apiConfig.getTranscriptionData(state.app), {
			body: requestObj
		}).then(
			response => {
				let transcriptArray = [...response.timestampedTranscripts];
				let sortedTranscriptArray = transcriptionModel.sort(
					transcriptArray
				);

				let evalParams = [...response.evaluationParameters];
				let transcriptionStatus = response.transcriptionStatus;

				return {
					transcriptionPane: {
						...state.transcriptionPane,
						filter: {
							...state.transcriptionPane.filter,
							evaluationParameters: evalParams
						},
						timestampedTranscripts: sortedTranscriptArray,
						searchedTranscripts: sortedTranscriptArray,
						transcriptionStatus: transcriptionStatus,
						loading: false,
						error: false
					}
				};
			},
			() => {
				return {
					transcriptionPane: {
						...state.transcriptionPane,
						filter: {
							...state.transcriptionPane.filter,
							evaluationParameters: []
						},
						timestampedTranscripts: [],
						searchedTranscripts: [],
						loading: false,
						error: true
					}
				};
			}
		);
	},

	navigateToMatchNum: (state, { currentMatchNumber }) => {
		let {
			highlightedTranscripts
		} = transcriptionModel.highlightCurrentMatch(
			state.transcriptionPane.searchedTranscripts,
			currentMatchNumber,
			state.transcriptionPane.searchBar.currentMatchNumber,
			state.transcriptionPane.matchedTranscriptIndices
		);
		return {
			...state,
			transcriptionPane: {
				...state.transcriptionPane,
				searchBar: {
					...state.transcriptionPane.searchBar,
					currentMatchNumber: currentMatchNumber
				},
				searchedTranscripts: highlightedTranscripts
			}
		};
	},

	updateTranscriptionSearchWords: (
		state,
		{ searchWords, selectedEvalParams }
	) => {
		searchWords =
			searchWords || state.transcriptionPane.searchBar.searchWords;
		selectedEvalParams =
			selectedEvalParams ||
			state.transcriptionPane.filter.selectedEvalParams;

		let searchKeywords = transcriptionModel.getKeywordsInParams(
			selectedEvalParams
		);
		let allWords = searchWords.concat(searchKeywords);

		let {
			searchedTranscripts,
			matchedTranscriptIndices
		} = transcriptionModel.search(
			state.transcriptionPane.timestampedTranscripts,
			allWords
		);

		return {
			...state,
			transcriptionPane: {
				...state.transcriptionPane,
				searchBar: {
					...state.transcriptionPane.searchBar,
					searchWords: searchWords,
					currentMatchNumber:
						matchedTranscriptIndices.length == 0 ? 0 : 1,
					numberOfMatches: matchedTranscriptIndices.length
				},
				filter: {
					...state.transcriptionPane.filter,
					selectedEvalParams: selectedEvalParams
				},
				searchedTranscripts: searchedTranscripts,
				matchedTranscriptIndices: matchedTranscriptIndices
			}
		};
	}
});