import { useState, useRef, useCallback, useEffect } from 'react';
import { RealWebRTCService } from '@/services/realWebRTCService';
import { useToast } from '@/components/ui/use-toast';
import { ErrorUtils } from '@/utils/errorUtils';

export interface UseRealWebRTCProps {
  userId: string;
}

export const useRealWebRTC = ({ userId }: UseRealWebRTCProps) => {
  const { toast } = useToast();
  const [isInCall, setIsInCall] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const webrtcServiceRef = useRef<RealWebRTCService | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize WebRTC service
  const initializeService = useCallback(() => {
    if (!webrtcServiceRef.current) {
      webrtcServiceRef.current = new RealWebRTCService(userId);
      
      // Set up event handlers
      webrtcServiceRef.current.onRemoteStream = (stream: MediaStream) => {
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      };
      
      webrtcServiceRef.current.onConnectionEstablished = () => {
        setIsConnected(true);
        toast({
          title: "Connected",
          description: "Video call connection established",
        });
      };
      
      webrtcServiceRef.current.onCallEnded = () => {
        handleEndCall();
      };
      
      webrtcServiceRef.current.onError = (error: string) => {
        console.error('❌ WebRTC error:', error);
        toast({
          title: "Connection Error",
          description: error,
          variant: "destructive",
        });
      };
    }
    
    return webrtcServiceRef.current;
  }, [userId, toast]);

  // Start a new call
  const startCall = useCallback(async (callType: 'video' | 'voice'): Promise<string> => {
    try {
      console.log(`🚀 Starting ${callType} call...`);
      const service = initializeService();
      const callId = await service.createCall(callType);
      
      // Get and set local stream
      const stream = service.getLocalStream();
      setLocalStream(stream);
      setIsInCall(true);
      
      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
      }
      
      toast({
        title: "Call Started",
        description: "Waiting for someone to join...",
      });
      
      return callId;
    } catch (error: any) {
      console.error('❌ Failed to start call:', error);
      
      // Provide more specific error messages based on the error type
      let userMessage = 'Failed to start call. Please try again.';
      
      if (error.message.includes('WebRTC initialization blocked')) {
        userMessage = 'Camera/microphone access required. Please allow permissions and try again.';
      } else if (error.message.includes('Secure context')) {
        userMessage = 'Secure connection required. Please use HTTPS.';
      } else if (error.message.includes('WebRTC is not supported')) {
        userMessage = 'Your browser does not support video calls. Please try a different browser.';
      } else if (error.message.includes('Media access')) {
        userMessage = 'Cannot access camera/microphone. Please check your device settings.';
      }
      
      toast({
        title: "Failed to Start Call",
        description: userMessage,
        variant: "destructive",
      });
      throw new Error(userMessage);
    }
  }, [initializeService, toast]);

  // Join an existing call
  const joinCall = useCallback(async (callId: string, callType: 'video' | 'voice'): Promise<void> => {
    try {
      console.log(`🚀 Joining ${callType} call: ${callId}`);
      const service = initializeService();
      await service.joinCall(callId, callType);
      
      // Get and set local stream
      const stream = service.getLocalStream();
      setLocalStream(stream);
      setIsInCall(true);
      
      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
      }
      
      toast({
        title: "Joined Call",
        description: "Connecting to call...",
      });
    } catch (error: any) {
      console.error('❌ Failed to join call:', error);
      
      // Provide more specific error messages
      let userMessage = 'Failed to join call. Please try again.';
      
      if (error.message.includes('WebRTC initialization blocked')) {
        userMessage = 'Camera/microphone access required. Please allow permissions and try again.';
      } else if (error.message.includes('Secure context')) {
        userMessage = 'Secure connection required. Please use HTTPS.';
      } else if (error.message.includes('WebRTC is not supported')) {
        userMessage = 'Your browser does not support video calls. Please try a different browser.';
      } else if (error.message.includes('Media access')) {
        userMessage = 'Cannot access camera/microphone. Please check your device settings.';
      }
      
      toast({
        title: "Failed to Join Call",
        description: userMessage,
        variant: "destructive",
      });
      throw new Error(userMessage);
    }
  }, [initializeService, toast]);

  // End the call
  const endCall = useCallback(async (reason?: string): Promise<void> => {
    try {
      if (webrtcServiceRef.current) {
        await webrtcServiceRef.current.endCall();
      }
      handleEndCall();
    } catch (error: any) {
      console.error('Error ending call:', error);
      toast({
        title: "Error Ending Call",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [toast]);

  // Handle call cleanup
  const handleEndCall = useCallback(() => {
    setIsInCall(false);
    setIsConnected(false);
    setLocalStream(null);
    setRemoteStream(null);
    
    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    webrtcServiceRef.current = null;
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(async (): Promise<boolean> => {
    if (webrtcServiceRef.current) {
      await webrtcServiceRef.current.toggleAudio();
      const newState = !isAudioEnabled;
      setIsAudioEnabled(newState);
      return newState;
    }
    return false;
  }, [isAudioEnabled]);

  // Toggle video
  const toggleVideo = useCallback(async (): Promise<boolean> => {
    if (webrtcServiceRef.current) {
      await webrtcServiceRef.current.toggleVideo();
      const newState = !isVideoEnabled;
      setIsVideoEnabled(newState);
      return newState;
    }
    return false;
  }, [isVideoEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (webrtcServiceRef.current) {
        webrtcServiceRef.current.endCall();
      }
    };
  }, []);

  return {
    // State
    isInCall,
    isConnected,
    isAudioEnabled,
    isVideoEnabled,
    localStream,
    remoteStream,
    
    // Refs for video elements
    localVideoRef,
    remoteVideoRef,
    
    // Actions
    startCall,
    joinCall,
    endCall,
    toggleAudio,
    toggleVideo
  };
};