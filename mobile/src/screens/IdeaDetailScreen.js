import React, { useState, useEffect, useCallback, memo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Pressable,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import BackgroundWrapper from "../components/BackgroundWrapper";
import GlassCard from "../components/GlassCard";
import Button from "../components/Button";
import LinkPreview from "../components/LinkPreview";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";
import { joinIdea, leaveIdea, onSocketEvent } from "../services/socket";

// Memoized invite form to prevent re-renders
const InviteForm = memo(({ ideaId, colors, onClose, showToast }) => {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setSending(true);
    try {
      await api.post("/collaborators/invite", {
        ideaId,
        email: email.trim(),
        role: "contributor",
      });
      showToast("Invitation sent!", "success");
      setEmail("");
      onClose();
    } catch (error) {
      showToast(error.message || "Failed to send invitation", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.inviteSection}>
      <GlassCard>
        <Text
          style={[
            styles.inviteTitle,
            {
              color: colors.text,
            },
          ]}
        >
          Invite Collaborator{" "}
        </Text>{" "}
        <TextInput
          style={[
            styles.inviteInput,
            {
              color: colors.text,
              borderColor: colors.glassBorder,
            },
          ]}
          placeholder="Enter email address"
          placeholderTextColor={colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Button
          title="Send Invite"
          onPress={handleInvite}
          loading={sending}
        />{" "}
      </GlassCard>{" "}
    </Animated.View>
  );
});

// Memoized reply composer to prevent re-renders
const ReplyComposer = memo(
  ({ ideaId, colors, onReplySubmitted, showToast }) => {
    const [content, setContent] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [sending, setSending] = useState(false);
    const fileInputRef = useRef(null);

    const handleSendReply = async () => {
      if (!content.trim() && !selectedFile) return;

      setSending(true);
      try {
        const reply = await api.post("/replies", {
          ideaId,
          content: content.trim() || "",
        });

        if (selectedFile) {
          await api.uploadFile("/attachments/upload", selectedFile, {
            ideaId,
            replyId: reply.id,
          });
        }

        setContent("");
        setSelectedFile(null);
        onReplySubmitted();
      } catch (error) {
        showToast("Failed to send reply", "error");
      } finally {
        setSending(false);
      }
    };

    const handlePickFile = async () => {
      if (Platform.OS === "web") {
        fileInputRef.current?.click();
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || "file",
          mimeType: asset.type === "video" ? "video/mp4" : "image/jpeg",
        });
      }
    };

    const handleWebFileChange = (event) => {
      const file = event.target.files?.[0];
      if (file) {
        setSelectedFile(file);
      }
    };

    const handleKeyPress = (e) => {
      if (
        Platform.OS === "web" &&
        e.nativeEvent.key === "Enter" &&
        !e.nativeEvent.shiftKey
      ) {
        e.preventDefault();
        handleSendReply();
      }
    };

    return (
      <View
        style={[
          styles.inputContainer,
          {
            borderTopColor: colors.glassBorder,
          },
        ]}
      >
        {" "}
        {Platform.OS === "web" && (
          <input
            type="file"
            ref={fileInputRef}
            style={{
              display: "none",
            }}
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            onChange={handleWebFileChange}
          />
        )}{" "}
        {selectedFile && (
          <View
            style={[
              styles.filePreview,
              {
                backgroundColor: colors.surface,
              },
            ]}
          >
            <Ionicons name="document" size={16} color={colors.accent} />{" "}
            <Text
              style={[
                styles.fileName,
                {
                  color: colors.text,
                },
              ]}
              numberOfLines={1}
            >
              {" "}
              {selectedFile.name}{" "}
            </Text>{" "}
            <TouchableOpacity onPress={() => setSelectedFile(null)}>
              <Ionicons
                name="close"
                size={18}
                color={colors.textSecondary}
              />{" "}
            </TouchableOpacity>{" "}
          </View>
        )}{" "}
        <View style={styles.inputRow}>
          <TouchableOpacity
            onPress={handlePickFile}
            style={styles.attachButton}
          >
            <Ionicons
              name="attach"
              size={24}
              color={colors.textSecondary}
            />{" "}
          </TouchableOpacity>{" "}
          <TextInput
            style={[
              styles.replyInput,
              {
                color: colors.text,
                backgroundColor: colors.surface,
              },
            ]}
            placeholder="Add to the thread..."
            placeholderTextColor={colors.textTertiary}
            value={content}
            onChangeText={setContent}
            multiline
            onKeyPress={handleKeyPress}
            blurOnSubmit={false}
          />{" "}
          <TouchableOpacity
            onPress={handleSendReply}
            disabled={(!content.trim() && !selectedFile) || sending}
            style={[
              styles.sendButton,
              {
                backgroundColor: colors.accent,
              },
              !content.trim() && !selectedFile && styles.sendButtonDisabled,
            ]}
          >
            <Ionicons name="send" size={18} color="#000" />
          </TouchableOpacity>{" "}
        </View>{" "}
      </View>
    );
  },
);

export default function IdeaDetailScreen({ route, navigation }) {
  const { ideaId } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [idea, setIdea] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    replyId: null,
  });
  const iconInputRef = useRef(null);
  const flatListRef = useRef(null);

  // Auto-scroll to bottom when replies change
  useEffect(() => {
    if (replies.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({
          animated: true,
        });
      }, 100);
    }
  }, [replies]);

  const fetchData = useCallback(
    async (isPolling = false) => {
      try {
        const [ideaData, repliesData] = await Promise.all([
          api.get(`/ideas/${ideaId}`),
          api.get(`/replies/idea/${ideaId}`),
        ]);

        setIdea((prev) => {
          const prevStr = JSON.stringify(prev);
          const newStr = JSON.stringify(ideaData);
          return prevStr === newStr ? prev : ideaData;
        });
        setReplies((prev) => {
          const prevStr = JSON.stringify(prev);
          const newStr = JSON.stringify(repliesData);
          return prevStr === newStr ? prev : repliesData;
        });
      } catch (error) {
        console.error("Fetch error:", error);
        if (!isPolling) {
          showToast("Failed to load idea", "error");
          navigation.goBack();
        }
      } finally {
        setLoading(false);
      }
    },
    [ideaId],
  );

  useEffect(() => {
    fetchData();

    joinIdea(ideaId);

    const unsubCreate = onSocketEvent("reply:created", (newReply) => {
      setReplies((prev) => {
        if (prev.some((r) => r.id === newReply.id)) return prev;
        return [...prev, newReply];
      });
    });

    const unsubDelete = onSocketEvent("reply:deleted", ({ id }) => {
      setReplies((prev) => prev.filter((r) => r.id !== id));
    });

    return () => {
      leaveIdea(ideaId);
      unsubCreate();
      unsubDelete();
    };
  }, [ideaId]);

  const handleDeleteReply = (replyId) => {
    setConfirmModal({
      visible: true,
      replyId,
    });
  };

  const confirmDeleteReply = async () => {
    const replyId = confirmModal.replyId;
    setConfirmModal({
      visible: false,
      replyId: null,
    });

    try {
      await api.delete(`/replies/${replyId}`);
      fetchData();
    } catch (error) {
      console.error("Failed to delete reply:", error);
    }
  };

  const handleIconPress = () => {
    if (idea?.user_id !== user?.id) return;
    if (Platform.OS === "web") {
      iconInputRef.current?.click();
    } else {
      pickIconNative();
    }
  };

  const pickIconNative = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (!result.canceled) {
      uploadIcon(result.assets[0]);
    }
  };

  const handleIconWebChange = (event) => {
    const file = event.target.files?.[0];
    if (file) uploadIcon(file);
  };

  const uploadIcon = async (file) => {
    try {
      await api.uploadFile(`/ideas/${ideaId}/icon`, file);
      fetchData();
    } catch (error) {
      showToast("Failed to upload icon", "error");
    }
  };

  const renderReply = ({ item, index }) => {
    const isOwn = item.user_id === user?.id;

    return (
      <Animated.View
        entering={FadeInUp.delay(index * 50).duration(300)}
        style={[styles.replyContainer, isOwn && styles.ownReply]}
      >
        <GlassCard style={[styles.replyCard, isOwn && styles.ownReplyCard]}>
          <View style={styles.replyHeader}>
            {" "}
            {item.author_avatar ? (
              <Image
                source={{
                  uri: item.author_avatar,
                }}
                style={styles.avatar}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: colors.accent,
                  },
                ]}
              >
                <Text style={styles.avatarText}>
                  {" "}
                  {item.author_name?.charAt(0)?.toUpperCase()}{" "}
                </Text>{" "}
              </View>
            )}{" "}
            <View style={styles.replyMeta}>
              <Text
                style={[
                  styles.authorName,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {" "}
                {item.author_name}{" "}
              </Text>{" "}
              <Text
                style={[
                  styles.replyTime,
                  {
                    color: colors.textTertiary,
                  },
                ]}
              >
                {" "}
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
              </Text>{" "}
            </View>{" "}
            {isOwn && (
              <TouchableOpacity
                onPress={() => handleDeleteReply(item.id)}
                style={styles.deleteButton}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={colors.textTertiary}
                />{" "}
              </TouchableOpacity>
            )}{" "}
          </View>{" "}
          {item.content ? (
            <Text
              style={[
                styles.replyContent,
                {
                  color: colors.text,
                },
              ]}
            >
              {" "}
              {item.content}{" "}
            </Text>
          ) : null}{" "}
          {item.content &&
            (item.content.match(/(https?:\/\/[^\s]+)/g) || [])[0] && (
              <LinkPreview
                url={(item.content.match(/(https?:\/\/[^\s]+)/g) || [])[0]}
              />
            )}{" "}
          {item.attachments?.filter(Boolean).length > 0 && (
            <View style={styles.attachments}>
              {" "}
              {item.attachments.filter(Boolean).map((att) => {
                const isImage = att.file_type?.startsWith("image/");
                const isVideo = att.file_type?.startsWith("video/");

                if (isImage) {
                  return (
                    <TouchableOpacity
                      key={att.id}
                      onPress={() => setSelectedImage(att.file_url)}
                      style={styles.imageAttachment}
                    >
                      {" "}
                      {Platform.OS === "web" ? (
                        <img
                          src={att.file_url}
                          alt={att.file_name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: 8,
                          }}
                        />
                      ) : (
                        <Image
                          source={{
                            uri: att.file_url,
                          }}
                          style={styles.attachmentImage}
                        />
                      )}{" "}
                    </TouchableOpacity>
                  );
                }

                if (isVideo) {
                  return (
                    <View key={att.id} style={styles.videoAttachment}>
                      {" "}
                      {Platform.OS === "web" ? (
                        <video
                          src={att.file_url}
                          controls
                          style={{
                            width: "100%",
                            maxHeight: 200,
                            borderRadius: 8,
                          }}
                        />
                      ) : (
                        <View
                          style={[
                            styles.attachment,
                            {
                              borderColor: colors.glassBorder,
                            },
                          ]}
                        >
                          <Ionicons
                            name="videocam"
                            size={14}
                            color={colors.textSecondary}
                          />{" "}
                          <Text
                            style={[
                              styles.attachmentName,
                              {
                                color: colors.textSecondary,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {" "}
                            {att.file_name}{" "}
                          </Text>{" "}
                        </View>
                      )}{" "}
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    key={att.id}
                    style={[
                      styles.attachment,
                      {
                        borderColor: colors.glassBorder,
                      },
                    ]}
                    onPress={() =>
                      Platform.OS === "web" &&
                      window.open(att.file_url, "_blank")
                    }
                  >
                    <Ionicons
                      name="document"
                      size={14}
                      color={colors.textSecondary}
                    />{" "}
                    <Text
                      style={[
                        styles.attachmentName,
                        {
                          color: colors.textSecondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {" "}
                      {att.file_name}{" "}
                    </Text>{" "}
                  </TouchableOpacity>
                );
              })}{" "}
            </View>
          )}{" "}
        </GlassCard>{" "}
      </Animated.View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {" "}
      {Platform.OS === "web" && (
        <input
          type="file"
          ref={iconInputRef}
          style={{
            display: "none",
          }}
          accept="image/*"
          onChange={handleIconWebChange}
        />
      )}{" "}
      <Animated.View entering={FadeIn.duration(400)}>
        <GlassCard intensity={40}>
          <View style={styles.ideaHeader}>
            <TouchableOpacity
              onPress={handleIconPress}
              disabled={idea?.user_id !== user?.id}
              style={[
                styles.iconContainer,
                {
                  backgroundColor: `${colors.accent}20`,
                },
              ]}
            >
              {" "}
              {idea?.icon_url ? (
                <Image
                  source={{
                    uri: idea.icon_url,
                  }}
                  style={styles.ideaIcon}
                />
              ) : (
                <Ionicons name="bulb" size={28} color={colors.accent} />
              )}{" "}
            </TouchableOpacity>{" "}
            <View
              style={{
                flex: 1,
              }}
            >
              {" "}
              {idea?.user_id === user?.id && (
                <Text
                  style={[
                    styles.tapHint,
                    {
                      color: colors.textTertiary,
                    },
                  ]}
                >
                  Tap icon to customize{" "}
                </Text>
              )}{" "}
              <Text
                style={[
                  styles.ideaTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {" "}
                {idea?.title}{" "}
              </Text>{" "}
            </View>{" "}
          </View>{" "}
          {idea?.content && (
            <Text
              style={[
                styles.ideaContent,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {" "}
              {idea.content}{" "}
            </Text>
          )}{" "}
          <View style={styles.ideaMeta}>
            <Text
              style={[
                styles.metaText,
                {
                  color: colors.textTertiary,
                },
              ]}
            >
              by {idea?.owner_name}•{" "}
              {new Date(idea?.created_at).toLocaleDateString()}{" "}
            </Text>{" "}
            {idea?.user_id === user?.id && (
              <TouchableOpacity
                style={styles.inviteButton}
                onPress={() => setShowInvite(!showInvite)}
              >
                <Ionicons
                  name="person-add-outline"
                  size={18}
                  color={colors.accent}
                />{" "}
                <Text
                  style={[
                    styles.inviteText,
                    {
                      color: colors.accent,
                    },
                  ]}
                >
                  {" "}
                  Invite{" "}
                </Text>{" "}
              </TouchableOpacity>
            )}{" "}
          </View>{" "}
        </GlassCard>{" "}
      </Animated.View>
      {showInvite && (
        <InviteForm
          ideaId={ideaId}
          colors={colors}
          onClose={() => setShowInvite(false)}
          showToast={showToast}
        />
      )}
      <Text
        style={[
          styles.repliesTitle,
          {
            color: colors.textSecondary,
          },
        ]}
      >
        Thread({replies.length}){" "}
      </Text>{" "}
    </View>
  );

  if (loading) {
    return (
      <BackgroundWrapper>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <Ionicons name="bulb" size={48} color={colors.accent} />{" "}
          </View>{" "}
        </SafeAreaView>{" "}
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />{" "}
          </TouchableOpacity>{" "}
          <Text
            style={[
              styles.navTitle,
              {
                color: colors.text,
              },
            ]}
            numberOfLines={1}
          >
            {" "}
            {idea?.title}{" "}
          </Text>{" "}
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("ThreadSettings", {
                ideaId,
              })
            }
            style={styles.settingsButton}
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={colors.text}
            />{" "}
          </TouchableOpacity>{" "}
        </View>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <FlatList
            ref={flatListRef}
            data={replies}
            keyExtractor={(item) => item.id}
            renderItem={renderReply}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={styles.list}
          />
          <ReplyComposer
            ideaId={ideaId}
            colors={colors}
            onReplySubmitted={fetchData}
            showToast={showToast}
          />{" "}
        </KeyboardAvoidingView>
        {/* Image Modal */}{" "}
        {selectedImage &&
          (Platform.OS === "web" ? (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => setSelectedImage(null)}
            >
              <img
                src={selectedImage}
                alt="Full size"
                style={{
                  maxWidth: "90%",
                  maxHeight: "90%",
                  objectFit: "contain",
                }}
              />{" "}
              <TouchableOpacity
                style={styles.closeImageButton}
                onPress={() => setSelectedImage(null)}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>{" "}
            </div>
          ) : (
            <Modal visible={!!selectedImage} transparent animationType="fade">
              <Pressable
                style={styles.imageModal}
                onPress={() => setSelectedImage(null)}
              >
                <Image
                  source={{
                    uri: selectedImage,
                  }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  style={styles.closeImageButton}
                  onPress={() => setSelectedImage(null)}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>{" "}
              </Pressable>{" "}
            </Modal>
          ))}
        {/* Delete Confirmation Modal */}{" "}
        {confirmModal.visible &&
          (Platform.OS === "web" ? (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() =>
                setConfirmModal({
                  visible: false,
                  replyId: null,
                })
              }
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: colors.glass,
                  borderRadius: 16,
                  padding: 24,
                  maxWidth: 320,
                  width: "90%",
                  border: `1px solid ${colors.glassBorder}`,
                }}
              >
                <Text
                  style={[
                    styles.confirmTitle,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  Delete Reply ?
                </Text>{" "}
                <Text
                  style={[
                    styles.confirmMessage,
                    {
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  This action cannot be undone.{" "}
                </Text>{" "}
                <View style={styles.confirmButtons}>
                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      styles.cancelButton,
                      {
                        borderColor: colors.glassBorder,
                      },
                    ]}
                    onPress={() =>
                      setConfirmModal({
                        visible: false,
                        replyId: null,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.confirmButtonText,
                        {
                          color: colors.text,
                        },
                      ]}
                    >
                      {" "}
                      Cancel{" "}
                    </Text>{" "}
                  </TouchableOpacity>{" "}
                  <TouchableOpacity
                    style={[styles.confirmButton, styles.deleteConfirmButton]}
                    onPress={confirmDeleteReply}
                  >
                    <Text
                      style={[
                        styles.confirmButtonText,
                        {
                          color: "#fff",
                        },
                      ]}
                    >
                      {" "}
                      Delete{" "}
                    </Text>{" "}
                  </TouchableOpacity>{" "}
                </View>{" "}
              </div>{" "}
            </div>
          ) : (
            <Modal
              visible={confirmModal.visible}
              transparent
              animationType="fade"
            >
              <View style={styles.modalOverlay}>
                <View
                  style={[
                    styles.confirmModalContent,
                    {
                      backgroundColor: colors.glass,
                      borderColor: colors.glassBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.confirmTitle,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    Delete Reply ?
                  </Text>{" "}
                  <Text
                    style={[
                      styles.confirmMessage,
                      {
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    This action cannot be undone.{" "}
                  </Text>{" "}
                  <View style={styles.confirmButtons}>
                    <TouchableOpacity
                      style={[
                        styles.confirmButton,
                        styles.cancelButton,
                        {
                          borderColor: colors.glassBorder,
                        },
                      ]}
                      onPress={() =>
                        setConfirmModal({
                          visible: false,
                          replyId: null,
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.confirmButtonText,
                          {
                            color: colors.text,
                          },
                        ]}
                      >
                        {" "}
                        Cancel{" "}
                      </Text>{" "}
                    </TouchableOpacity>{" "}
                    <TouchableOpacity
                      style={[styles.confirmButton, styles.deleteConfirmButton]}
                      onPress={confirmDeleteReply}
                    >
                      <Text
                        style={[
                          styles.confirmButtonText,
                          {
                            color: "#fff",
                          },
                        ]}
                      >
                        {" "}
                        Delete{" "}
                      </Text>{" "}
                    </TouchableOpacity>{" "}
                  </View>{" "}
                </View>{" "}
              </View>{" "}
            </Modal>
          ))}{" "}
      </SafeAreaView>{" "}
    </BackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  navTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginHorizontal: 8,
  },
  settingsButton: {
    padding: 8,
  },
  list: {
    padding: 16,
    paddingBottom: 20,
  },
  header: {
    marginBottom: 16,
  },
  ideaHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  ideaIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  tapHint: {
    fontSize: 10,
    marginBottom: 2,
  },
  ideaTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  ideaContent: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  ideaMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaText: {
    fontSize: 12,
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inviteText: {
    fontSize: 14,
    fontWeight: "600",
  },
  inviteSection: {
    marginTop: 12,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  inviteInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  repliesTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 8,
  },
  replyContainer: {
    marginBottom: 12,
    maxWidth: "85%",
    alignSelf: "flex-start",
  },
  ownReply: {
    alignSelf: "flex-end",
  },
  replyCard: {},
  ownReplyCard: {},
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "600",
  },
  replyMeta: {
    marginLeft: 8,
    flex: 1,
  },
  authorName: {
    fontSize: 13,
    fontWeight: "600",
  },
  replyTime: {
    fontSize: 11,
  },
  deleteButton: {
    padding: 4,
  },
  replyContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  attachments: {
    marginTop: 8,
    gap: 8,
  },
  attachment: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  attachmentName: {
    fontSize: 12,
    flex: 1,
  },
  imageAttachment: {
    width: 200,
    height: 150,
    borderRadius: 8,
    overflow: "hidden",
  },
  attachmentImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  videoAttachment: {
    maxWidth: 280,
  },
  inputContainer: {
    padding: 8,
    paddingBottom: Platform.OS === "ios" ? 8 : 8,
    borderTopWidth: 1,
  },
  filePreview: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  attachButton: {
    padding: 8,
  },
  replyInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  imageModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.8,
  },
  closeImageButton: {
    position: "absolute",
    top: 50,
    right: 20,
    padding: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmModalContent: {
    borderRadius: 16,
    padding: 24,
    maxWidth: 320,
    width: "90%",
    borderWidth: 1,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: "row",
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  deleteConfirmButton: {
    backgroundColor: "#ef4444",
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
