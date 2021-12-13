import { SET_ROOM, UPDATE_ROOM } from './action-types';

export const initialState = {
  settings:{
    hostVoteRequired: (process.env.NEXT_PUBLIC_HOST_VOTE_REQUIRED == 'true')
  },
  room: {
    id: null,
    name: '',
    host: { id: null, name: '' },
    cardsMode: '',
    guests: [],
  },
};

export const setRoom = (state, { room }) => ({
  ...state,
  room,
});

export const updateRoom = (state, { updates }) => ({
  ...state,
  room: {
    ...state.room,
    ...updates,
  },
});

export const reducer = (state = initialState, action) => {
  switch (action.type) {
  case SET_ROOM: return setRoom(state, action);
  case UPDATE_ROOM: return updateRoom(state, action);
  default:
    return state;
  }
};

export default reducer;
