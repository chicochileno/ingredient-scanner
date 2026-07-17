const express = require('express');
const admin = require('../utils/firebaseAdmin');
const { buildProfileShare, buildListShare, isValidShareId } = require('../utils/shareData');
const { getProfileWithInputs } = require('../utils/userMatchData');
const { createRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const limiter = createRateLimiter({ max: 60, windowMs: 60000 });

router.get('/:shareId', limiter, async (req, res) => {
  const { shareId } = req.params;
  if (!isValidShareId(shareId)) return res.status(400).json({ error: 'Invalid link' });
  try {
    const db = admin.firestore();
    const shareSnap = await db.collection('shares').doc(shareId).get();
    if (!shareSnap.exists) return res.status(404).json({ error: 'not_found' });
    const share = shareSnap.data();
    if (share.revoked) return res.status(404).json({ error: 'not_found' });

    if (share.type === 'profile') {
      const p = await getProfileWithInputs(share.ownerUid, share.refId);
      if (!p) return res.status(404).json({ error: 'not_found' });
      return res.json(buildProfileShare({ name: p.name, activeCategories: p.activeCategories }, p.personalAllergens));
    }

    if (share.type === 'list') {
      const listRef = db.collection('users').doc(share.ownerUid).collection('lists').doc(share.refId);
      const [listSnap, itemsSnap, profile] = await Promise.all([
        listRef.get(),
        listRef.collection('items').orderBy('addedAt').get(),
        getProfileWithInputs(share.ownerUid, share.profileId),
      ]);
      if (!listSnap.exists || !profile) return res.status(404).json({ error: 'not_found' });
      const items = itemsSnap.docs.map((d) => d.data());
      return res.json(buildListShare(listSnap.data().name, profile.name, items, {
        activeCategories: profile.activeCategories,
        personalAllergens: profile.personalAllergens,
        dismissedIds: profile.dismissedIds,
      }));
    }

    return res.status(404).json({ error: 'not_found' });
  } catch (err) {
    console.error('Share resolve error:', err.message);
    res.status(500).json({ error: 'Failed to load share' });
  }
});

module.exports = router;
