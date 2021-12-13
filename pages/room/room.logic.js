import React, {
  useEffect, useState, useCallback, useMemo,
} from 'react';
import PropTypes from 'prop-types';
import { useRouter } from 'next/router';

import { setRoom } from '../../reducer/actions';
import { useGlobalState } from '../../context/global-state';
import { useSocket } from '../../context/socket';
import Layout from '../../components/layout';
import HtmlHead from '../../components/html-head';
import HostView from '../../components/host-view';
import GuestView from '../../components/guest-view';

export default function Room({ className }) {
  const router = useRouter();
  const socket = useSocket();
  const [{ room = {}, settings }, dispatch] = useGlobalState();
  const [listenersReady, setListenersReady] = useState(false);
  const [guestsVoted, setGuestsVoted] = useState(false);
  const [hostVoted, setHostVoted] = useState(false);
  const [votedValue, setVotedValue] = useState(null);
  const [sessionStarted, setSessionStarted] = useState(false);

  const updateRoom = useCallback((updatedRoom) => {
    dispatch(setRoom(updatedRoom));
  }, [dispatch]);

  const kickGuestOut = useCallback((reason) => {
    alert(reason);
    router.replace('/unexisting-room', { reason });
  }, [router]);

  const onGuestJoin = useCallback((updatedRoom) => {
    if (!sessionStarted) {
      setSessionStarted(false);
    }
    dispatch(setRoom(updatedRoom));
  }, [dispatch, sessionStarted]);

  const updateGuestsVoted = useCallback((updatedRoom) => {
    if (updatedRoom.guests.every(({ vote }) => !!vote)) {
      setGuestsVoted(true);
    }
  }, []);

  const updateHostVoted = useCallback((updatedRoom) => {
    if (updatedRoom.host.vote || !settings.hostVoteRequired) {
      setHostVoted(true);
    }
  }, []);

  const onVoted = useCallback((updatedRoom) => {
    updateGuestsVoted(updatedRoom);
    updateHostVoted(updatedRoom);
    dispatch(setRoom(updatedRoom));
  }, [dispatch, updateGuestsVoted, updateHostVoted]);

  const onVotesCleared = useCallback((updatedRoom) => {
    setGuestsVoted(false);
    setHostVoted(false);
    setVotedValue(null);
    dispatch(setRoom(updatedRoom));
  }, [dispatch]);

  const onGuestKickedOut = useCallback(({ guestId, room: updatedRoom }) => {
    if (socket && socket.id === guestId) {
      router.replace('/kicked-out');
      return;
    }
    updateGuestsVoted(updatedRoom);
    updateHostVoted(updatedRoom);
    updateRoom(updatedRoom);
  }, [router, socket, updateRoom, updateGuestsVoted, updateHostVoted]);

  const addListeners = useCallback(() => {
    if (socket && !listenersReady) {
      socket.on('unexistingRoom', () => kickGuestOut('The room does no longer exist'));
      socket.on('guestJoined', onGuestJoin);
      socket.on('guestLeft', updateRoom);
      socket.on('hostLeft', () => kickGuestOut('The host has ended the session'));
      socket.on('voted', onVoted);
      socket.on('votesCleared', onVotesCleared);
      socket.on('sessionStarted', () => setSessionStarted(true));
      socket.on('guestKickedOut', onGuestKickedOut);
      setListenersReady(true);
    }
  }, [
    socket, onVoted, onVotesCleared, kickGuestOut,
    listenersReady, onGuestJoin, updateRoom, onGuestKickedOut,
  ]);

  const vote = useCallback((value) => {
    setVotedValue(value);
    socket.emit('vote', { roomId: room.id, value });
  }, [socket, room.id]);

  const clearVotes = useCallback(() => {
    socket.emit('clearVotes', room.id);
  }, [socket, room.id]);

  const startSession = useCallback(() => {
    socket.emit('startSession', room.id);
  }, [socket, room]);

  useEffect(() => {
    if (!room.id) {
      router.push('/');
      return;
    }

    if (socket && !listenersReady) {
      addListeners();
    }
  }, [socket, router, room.id, addListeners, listenersReady]);

  const ViewComponent = useMemo(() => {
    if (!socket || !room.id) {
      return null;
    }

    const isHost = socket.id === room.host.id;

    const GuestComponent = (
      <GuestView
        room={room}
        vote={vote}
        votedValue={votedValue}
        sessionStarted={sessionStarted}
      />
    );

    const HostComponent = (
      <HostView
        room={room}
        guestsVoted={guestsVoted}
        hostVoted={hostVoted}
        clearVotes={clearVotes}
        isHost={isHost}
        hostVoteRequired={settings.hostVoteRequired}
        startSession={startSession}
        sessionStarted={sessionStarted}
      />
    );

    if (isHost) {
      return (guestsVoted && !hostVoted)
        ? GuestComponent
        : HostComponent;
    }

    return (guestsVoted && hostVoted)
      ? HostComponent
      : GuestComponent;
  }, [
    room, sessionStarted, socket, votedValue, guestsVoted,
    vote, clearVotes, hostVoted, startSession,
  ]);

  return (socket && room.id) ? (
    <div id="room-component" className={`${className}`}>
      <Layout>
        <HtmlHead title="Scrum poker - Room" />
        <div className="component-room__content">
          <h1 className="component-room__title">{room.name}</h1>
          {ViewComponent}
        </div>
      </Layout>
    </div>
  ) : null;
}

Room.propTypes = {
  className: PropTypes.string,
};

Room.defaultProps = {
  className: '',
};
