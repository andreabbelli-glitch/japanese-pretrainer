CREATE INDEX `review_subject_state_kanji_clash_idx` ON `review_subject_state` (`subject_type`,`state`,`entry_id`,`cross_media_group_id`) WHERE "review_subject_state"."entry_type" = 'term'
          and "review_subject_state"."subject_type" in ('entry', 'group')
          and "review_subject_state"."state" in ('review', 'relearning')
          and "review_subject_state"."manual_override" = 0
          and "review_subject_state"."suspended" = 0
          and "review_subject_state"."stability" >= 7
          and "review_subject_state"."reps" >= 2;