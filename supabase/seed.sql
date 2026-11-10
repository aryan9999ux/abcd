-- Sample plan rules and prices. Replace with the real numbers before launch.
insert into public.plans (key,name,evaluation_phases,phase1_target_pct,phase2_target_pct,max_daily_loss_pct,max_overall_loss_pct,min_trading_days,reward_split_pct) values
 ('instant','Instant',0,null,null,3,6,5,80),
 ('one_step','1-Step',1,8,null,4,8,5,80),
 ('two_step','2-Step',2,8,5,4,8,5,80);
insert into public.plan_prices (plan_key,account_size,price_inr) values
 ('instant',100000,5999),('instant',250000,12999),('instant',500000,22999),('instant',1000000,39999),
 ('one_step',100000,2999),('one_step',250000,6499),('one_step',500000,11499),('one_step',1000000,19999),
 ('two_step',100000,1999),('two_step',250000,4499),('two_step',500000,7999),('two_step',1000000,13999);
