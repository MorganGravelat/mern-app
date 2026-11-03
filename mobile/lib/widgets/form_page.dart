import 'package:flutter/material.dart';

import '../theme.dart';

// Same layout for every form screen: app bar, scrolling column, limited width on tablets.
// With brand: true (the sign-in screens) the app bar shows the OpsFlow logo and the title
// becomes a big heading with an optional small green eyebrow line and a subtitle.
class FormPage extends StatelessWidget {
  const FormPage({
    super.key,
    required this.title,
    required this.children,
    this.brand = false,
    this.eyebrow,
    this.subtitle,
  });

  final String title;
  final List<Widget> children;
  final bool brand;
  final String? eyebrow;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: brand ? AppBar(title: const OpsFlowBrand()) : AppBar(title: Text(title)),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (brand) ...[
                  const SizedBox(height: 8),
                  if (eyebrow != null) Text(eyebrow!, style: monoStyle(size: 12)),
                  Text(title, style: textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
                  if (subtitle != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(subtitle!, style: const TextStyle(color: mutedColor)),
                    ),
                  const SizedBox(height: 20),
                ],
                ...children,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// A message under a form. liveRegion makes screen readers announce it when it appears.
class StatusMessage extends StatelessWidget {
  const StatusMessage({super.key, required this.message, this.isError = true});

  final String? message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final text = message;
    if (text == null || text.isEmpty) return const SizedBox.shrink();
    final color = isError ? errorColor : accentColor;
    return Semantics(
      liveRegion: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w600)),
      ),
    );
  }
}
