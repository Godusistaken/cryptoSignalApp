import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../utils/colors';
import { Radius, Spacing } from '../utils/theme';

export default function StateView({
  icon = 'alert-circle-outline',
  title,
  message,
  actionLabel,
  onAction,
  loading = false,
  compact = false,
}) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.iconBox}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Ionicons name={icon} size={28} color={Colors.primaryLight} />
        )}
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.button} onPress={onAction} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: Spacing.xl,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  wrapCompact: {
    marginHorizontal: 0,
    marginTop: 0,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    marginTop: Spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.lg,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
